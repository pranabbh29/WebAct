"""
FastAPI backend for WebAct UI.
Supabase-backed with Google OAuth. Streams agent steps via SSE.
"""

import asyncio
import base64
import json
import logging
import os
import sys
import uuid
from datetime import datetime
from pathlib import Path

from dotenv import load_dotenv
from fastapi import Depends, FastAPI, File, Form, HTTPException, Request, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, StreamingResponse
from jose import JWTError, jwt
from pydantic import BaseModel
from supabase import Client as SupabaseClient
from supabase import create_client

load_dotenv(Path(__file__).parent.parent / '.env')
sys.path.insert(0, str(Path(__file__).parent.parent))

from webact import Agent, Browser, BrowserProfile, ChatGoogle
from webact.llm.messages import ContentPartImageParam

logger = logging.getLogger(__name__)

app = FastAPI(title="WebAct API")

app.add_middleware(
	CORSMiddleware,
	allow_origins=["*"],
	allow_methods=["*"],
	allow_headers=["*"],
)

# Serve React frontend static files in production
STATIC_DIR = Path(__file__).parent.parent / "frontend" / "dist"
if STATIC_DIR.exists():
	from fastapi.staticfiles import StaticFiles
	from fastapi.responses import FileResponse

	@app.get("/")
	async def serve_index():
		return FileResponse(STATIC_DIR / "index.html")

# ============================================================
# Supabase client
# ============================================================
SUPABASE_URL = os.getenv("SUPABASE_URL", "")
SUPABASE_SERVICE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "")
SUPABASE_JWT_SECRET = os.getenv("SUPABASE_JWT_SECRET", "")

supabase: SupabaseClient = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)

# ============================================================
# Auth dependency
# ============================================================
async def get_current_user(request: Request) -> str:
	"""Extract user_id from Supabase JWT."""
	auth_header = request.headers.get("Authorization", "")
	token = None

	if auth_header.startswith("Bearer "):
		token = auth_header[7:]
	else:
		# Fallback for SSE — token in query param
		token = request.query_params.get("token")

	if not token:
		logging.warning("[AUTH] No token found in request")
		raise HTTPException(status_code=401, detail="Missing auth token")

	logging.info(f"[AUTH] Token received: {token[:20]}...")

	try:
		# Try legacy HS256 verification first
		logging.info("[AUTH] Trying HS256 JWT decode...")
		payload = jwt.decode(
			token,
			SUPABASE_JWT_SECRET,
			algorithms=["HS256"],
			audience="authenticated",
		)
		user_id = payload.get("sub")
		if not user_id:
			logging.warning("[AUTH] HS256 decoded but no 'sub' in payload")
			raise HTTPException(status_code=401, detail="Invalid token")
		logging.info(f"[AUTH] HS256 success — user_id={user_id}")
		return user_id
	except JWTError as e:
		logging.warning(f"[AUTH] HS256 failed: {e}")

	# Fallback: verify token via Supabase auth API
	try:
		logging.info("[AUTH] Trying Supabase auth.get_user() fallback...")
		user_resp = supabase.auth.get_user(token)
		if user_resp and user_resp.user:
			logging.info(f"[AUTH] Supabase fallback success — user_id={user_resp.user.id}")
			return user_resp.user.id
		logging.warning("[AUTH] Supabase fallback returned no user")
	except Exception as e:
		logging.error(f"[AUTH] Supabase fallback failed: {e}")

	logging.error("[AUTH] All auth methods failed")
	raise HTTPException(status_code=401, detail="Invalid token")


# ============================================================
# In-memory stores (only for running tasks)
# ============================================================
running_tasks: dict[str, dict] = {}
running_agents: dict[str, Agent] = {}
running_asyncio_tasks: dict[str, asyncio.Task] = {}

UPLOAD_DIR = Path(__file__).parent / "uploads"
UPLOAD_DIR.mkdir(exist_ok=True)


# ============================================================
# Pydantic models
# ============================================================
class RemoteBrowserCreate(BaseModel):
	name: str
	ws_url: str

class SkillCreate(BaseModel):
	name: str
	description: str = ""
	prompt: str

class SkillRun(BaseModel):
	skill_id: str

class ScheduledJobCreate(BaseModel):
	name: str
	task: str
	cron: str
	enabled: bool = True

class ScheduledJobUpdate(BaseModel):
	enabled: bool | None = None
	name: str | None = None
	task: str | None = None
	cron: str | None = None


# ============================================================
# Agent Task APIs
# ============================================================
@app.post("/api/run")
async def run_task(
	task: str = Form(...),
	max_steps: int = Form(25),
	files: list[UploadFile] = File(default=[]),
	user_id: str = Depends(get_current_user),
):
	task_id = str(uuid.uuid4())[:8]

	uploaded_paths = []
	sample_images = []
	task_upload_dir = UPLOAD_DIR / task_id
	task_upload_dir.mkdir(exist_ok=True)

	for f in files:
		if not f.filename:
			continue
		file_path = task_upload_dir / f.filename
		content = await f.read()
		file_path.write_bytes(content)
		uploaded_paths.append(str(file_path))

		ext = file_path.suffix.lower()
		if ext in ('.png', '.jpg', '.jpeg', '.gif', '.webp'):
			b64 = base64.b64encode(content).decode('utf-8')
			mime = {'.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
					'.gif': 'image/gif', '.webp': 'image/webp'}.get(ext, 'image/png')
			sample_images.append(
				ContentPartImageParam(type='image_url', image_url={'url': f'data:{mime};base64,{b64}'})
			)

	task_text = task
	if uploaded_paths:
		file_names = [Path(p).name for p in uploaded_paths]
		task_text += f"\n\n[Attached files: {', '.join(file_names)}. File paths: {', '.join(uploaded_paths)}]"

	# Get user settings for model
	settings = _get_user_settings(user_id)
	model = settings.get("default_model", "gemini-2.5-flash")

	file_names_list = [Path(p).name for p in uploaded_paths]

	# Insert session into Supabase
	supabase.table("sessions").insert({
		"id": task_id,
		"user_id": user_id,
		"task": task,
		"status": "running",
		"files": file_names_list,
		"model": model,
	}).execute()

	# In-memory for SSE streaming
	running_tasks[task_id] = {
		"id": task_id,
		"user_id": user_id,
		"task": task,
		"status": "running",
		"steps": [],
		"steps_count": 0,
		"result": None,
		"error": None,
		"files": file_names_list,
		"model": model,
		"created_at": datetime.now().isoformat(),
		"duration": 0,
	}

	bg_task = asyncio.create_task(
		_run_agent(task_id, user_id, task_text, max_steps, model, uploaded_paths, sample_images, settings)
	)
	running_asyncio_tasks[task_id] = bg_task
	return {"task_id": task_id}


@app.post("/api/stop/{task_id}")
async def stop_task(task_id: str, user_id: str = Depends(get_current_user)):
	if task_id not in running_tasks:
		raise HTTPException(status_code=404, detail="Task not found")
	if running_tasks[task_id].get("user_id") != user_id:
		raise HTTPException(status_code=403, detail="Not your task")

	task_data = running_tasks[task_id]
	if task_data["status"] != "running":
		raise HTTPException(status_code=400, detail="Task is not running")

	bg_task = running_asyncio_tasks.get(task_id)
	if bg_task and not bg_task.done():
		bg_task.cancel()

	agent = running_agents.get(task_id)
	if agent and agent.browser_session:
		try:
			await agent.browser_session.stop()
		except Exception:
			pass

	task_data["status"] = "error"
	task_data["error"] = "Stopped by user"
	running_agents.pop(task_id, None)
	running_asyncio_tasks.pop(task_id, None)
	return {"status": "stopped"}


@app.get("/api/stream/{task_id}")
async def stream_task(task_id: str, user_id: str = Depends(get_current_user)):
	if task_id not in running_tasks:
		raise HTTPException(status_code=404, detail="Task not found")
	if running_tasks[task_id].get("user_id") != user_id:
		raise HTTPException(status_code=403, detail="Not your task")

	async def event_generator():
		last_step_count = 0
		while True:
			task_data = running_tasks.get(task_id)
			if not task_data:
				break

			current_steps = task_data["steps"]
			n = len(current_steps)
			if n > last_step_count:
				for step in current_steps[last_step_count:n]:
					yield f"data: {json.dumps(step)}\n\n"
				last_step_count = n

			if task_data["status"] in ("done", "error"):
				final = {
					"type": "final",
					"status": task_data["status"],
					"result": task_data["result"],
					"error": task_data["error"],
				}
				yield f"data: {json.dumps(final)}\n\n"
				break

			await asyncio.sleep(0.5)

	return StreamingResponse(
		event_generator(),
		media_type="text/event-stream",
		headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
	)


# ============================================================
# Sessions APIs (Supabase-backed)
# ============================================================
@app.get("/api/sessions")
async def list_sessions(user_id: str = Depends(get_current_user)):
	result = supabase.table("sessions") \
		.select("id, task, status, result, error, files, model, steps_count, duration, created_at") \
		.eq("user_id", user_id) \
		.order("created_at", desc=True) \
		.execute()
	return result.data


@app.get("/api/sessions/{session_id}")
async def get_session(session_id: str, user_id: str = Depends(get_current_user)):
	# Check in-memory first (running task)
	if session_id in running_tasks and running_tasks[session_id].get("user_id") == user_id:
		return running_tasks[session_id]

	# Fetch from Supabase
	result = supabase.table("sessions") \
		.select("*") \
		.eq("id", session_id) \
		.eq("user_id", user_id) \
		.single() \
		.execute()
	if not result.data:
		raise HTTPException(status_code=404, detail="Session not found")

	session = result.data

	# Fetch steps
	steps_result = supabase.table("session_steps") \
		.select("*") \
		.eq("session_id", session_id) \
		.eq("user_id", user_id) \
		.order("step_number") \
		.execute()

	session["steps"] = [
		{
			"type": "step",
			"step": s["step_number"],
			"thinking": s.get("thinking", ""),
			"evaluation": s.get("evaluation", ""),
			"memory": s.get("memory", ""),
			"next_goal": s.get("next_goal", ""),
			"actions": s.get("actions", []),
			"screenshot": s.get("screenshot"),
		}
		for s in (steps_result.data or [])
	]

	return session


@app.delete("/api/sessions/{session_id}")
async def delete_session(session_id: str, user_id: str = Depends(get_current_user)):
	# Stop if running
	if session_id in running_tasks and running_tasks[session_id].get("user_id") == user_id:
		bg_task = running_asyncio_tasks.get(session_id)
		if bg_task and not bg_task.done():
			bg_task.cancel()
		running_agents.pop(session_id, None)
		running_asyncio_tasks.pop(session_id, None)
		running_tasks.pop(session_id, None)

	supabase.table("sessions").delete().eq("id", session_id).eq("user_id", user_id).execute()
	return {"status": "deleted"}


# ============================================================
# Remote Browsers APIs (Supabase-backed)
# ============================================================
@app.get("/api/remote-browsers")
async def list_remote_browsers(user_id: str = Depends(get_current_user)):
	result = supabase.table("remote_browsers").select("*").eq("user_id", user_id).execute()
	return result.data


@app.post("/api/remote-browsers")
async def create_remote_browser(data: RemoteBrowserCreate, user_id: str = Depends(get_current_user)):
	browser_id = str(uuid.uuid4())[:8]
	row = {"id": browser_id, "user_id": user_id, "name": data.name, "ws_url": data.ws_url, "status": "unknown"}
	supabase.table("remote_browsers").insert(row).execute()
	return row


@app.delete("/api/remote-browsers/{browser_id}")
async def delete_remote_browser(browser_id: str, user_id: str = Depends(get_current_user)):
	supabase.table("remote_browsers").delete().eq("id", browser_id).eq("user_id", user_id).execute()
	return {"status": "deleted"}


@app.post("/api/remote-browsers/{browser_id}/test")
async def test_remote_browser(browser_id: str, user_id: str = Depends(get_current_user)):
	result = supabase.table("remote_browsers").select("*").eq("id", browser_id).eq("user_id", user_id).single().execute()
	if not result.data:
		raise HTTPException(status_code=404, detail="Browser not found")

	browser_data = result.data
	try:
		import websockets
		async with websockets.connect(browser_data["ws_url"], close_timeout=5) as ws:
			await ws.close()
		supabase.table("remote_browsers").update({"status": "connected"}).eq("id", browser_id).execute()
		return {"status": "connected"}
	except Exception as e:
		supabase.table("remote_browsers").update({"status": "error"}).eq("id", browser_id).execute()
		return {"status": "error", "detail": str(e)}


# ============================================================
# Skills APIs (Supabase-backed)
# ============================================================
@app.get("/api/skills")
async def list_skills(user_id: str = Depends(get_current_user)):
	result = supabase.table("skills").select("*").eq("user_id", user_id).execute()
	return result.data


@app.post("/api/skills")
async def create_skill(data: SkillCreate, user_id: str = Depends(get_current_user)):
	skill_id = str(uuid.uuid4())[:8]
	row = {"id": skill_id, "user_id": user_id, "name": data.name, "description": data.description, "prompt": data.prompt}
	supabase.table("skills").insert(row).execute()
	return row


@app.delete("/api/skills/{skill_id}")
async def delete_skill(skill_id: str, user_id: str = Depends(get_current_user)):
	supabase.table("skills").delete().eq("id", skill_id).eq("user_id", user_id).execute()
	return {"status": "deleted"}


@app.post("/api/skills/run")
async def run_skill(data: SkillRun, user_id: str = Depends(get_current_user)):
	result = supabase.table("skills").select("*").eq("id", data.skill_id).eq("user_id", user_id).single().execute()
	if not result.data:
		raise HTTPException(status_code=404, detail="Skill not found")

	skill = result.data
	settings = _get_user_settings(user_id)
	model = settings.get("default_model", "gemini-2.5-flash")

	task_id = str(uuid.uuid4())[:8]
	supabase.table("sessions").insert({
		"id": task_id, "user_id": user_id, "task": skill["prompt"], "status": "running", "model": model,
	}).execute()

	running_tasks[task_id] = {
		"id": task_id, "user_id": user_id, "task": skill["prompt"], "status": "running",
		"steps": [], "steps_count": 0, "result": None, "error": None,
		"files": [], "model": model, "created_at": datetime.now().isoformat(), "duration": 0,
	}

	bg_task = asyncio.create_task(
		_run_agent(task_id, user_id, skill["prompt"], settings.get("max_steps", 25), model, [], [], settings)
	)
	running_asyncio_tasks[task_id] = bg_task
	return {"task_id": task_id, "status": "started"}


# ============================================================
# Scheduled Jobs APIs (Supabase-backed)
# ============================================================
@app.get("/api/scheduled-jobs")
async def list_scheduled_jobs(user_id: str = Depends(get_current_user)):
	result = supabase.table("scheduled_jobs").select("*").eq("user_id", user_id).execute()
	return result.data


@app.post("/api/scheduled-jobs")
async def create_scheduled_job(data: ScheduledJobCreate, user_id: str = Depends(get_current_user)):
	job_id = str(uuid.uuid4())[:8]
	row = {"id": job_id, "user_id": user_id, "name": data.name, "task": data.task, "cron": data.cron, "enabled": data.enabled}
	supabase.table("scheduled_jobs").insert(row).execute()
	return row


@app.patch("/api/scheduled-jobs/{job_id}")
async def update_scheduled_job(job_id: str, data: ScheduledJobUpdate, user_id: str = Depends(get_current_user)):
	updates = {k: v for k, v in data.model_dump(exclude_none=True).items()}
	if not updates:
		raise HTTPException(status_code=400, detail="No fields to update")
	result = supabase.table("scheduled_jobs").update(updates).eq("id", job_id).eq("user_id", user_id).execute()
	if not result.data:
		raise HTTPException(status_code=404, detail="Job not found")
	return result.data[0]


@app.delete("/api/scheduled-jobs/{job_id}")
async def delete_scheduled_job(job_id: str, user_id: str = Depends(get_current_user)):
	supabase.table("scheduled_jobs").delete().eq("id", job_id).eq("user_id", user_id).execute()
	return {"status": "deleted"}


@app.post("/api/scheduled-jobs/{job_id}/run")
async def run_scheduled_job(job_id: str, user_id: str = Depends(get_current_user)):
	result = supabase.table("scheduled_jobs").select("*").eq("id", job_id).eq("user_id", user_id).single().execute()
	if not result.data:
		raise HTTPException(status_code=404, detail="Job not found")

	job = result.data
	supabase.table("scheduled_jobs").update({"last_run": datetime.now().isoformat()}).eq("id", job_id).execute()

	settings = _get_user_settings(user_id)
	model = settings.get("default_model", "gemini-2.5-flash")

	task_id = str(uuid.uuid4())[:8]
	supabase.table("sessions").insert({
		"id": task_id, "user_id": user_id, "task": job["task"], "status": "running", "model": model,
	}).execute()

	running_tasks[task_id] = {
		"id": task_id, "user_id": user_id, "task": job["task"], "status": "running",
		"steps": [], "steps_count": 0, "result": None, "error": None,
		"files": [], "model": model, "created_at": datetime.now().isoformat(), "duration": 0,
	}

	bg_task = asyncio.create_task(
		_run_agent(task_id, user_id, job["task"], settings.get("max_steps", 25), model, [], [], settings)
	)
	running_asyncio_tasks[task_id] = bg_task
	return {"task_id": task_id, "status": "started"}


# ============================================================
# Analytics API (Supabase-backed)
# ============================================================
@app.get("/api/analytics")
async def get_analytics(user_id: str = Depends(get_current_user)):
	result = supabase.table("sessions") \
		.select("task, status, steps_count, duration, created_at") \
		.eq("user_id", user_id) \
		.execute()

	all_tasks = result.data or []
	total = len(all_tasks)
	completed = sum(1 for t in all_tasks if t["status"] == "done")
	failed = sum(1 for t in all_tasks if t["status"] == "error")
	running = sum(1 for t in all_tasks if t["status"] == "running")

	steps_list = [t.get("steps_count", 0) for t in all_tasks]
	avg_steps = round(sum(steps_list) / max(total, 1), 1)
	durations = [t.get("duration", 0) for t in all_tasks if (t.get("duration") or 0) > 0]
	avg_duration = round(sum(durations) / max(len(durations), 1), 1)
	success_rate = round(completed / max(total, 1) * 100, 1)

	recent_tasks = []
	sorted_tasks = sorted(all_tasks, key=lambda x: x.get("created_at", ""), reverse=True)[:10]
	for t in sorted_tasks:
		recent_tasks.append({
			"task": t["task"], "status": t["status"],
			"steps": t.get("steps_count", 0), "duration": t.get("duration", 0),
		})

	return {
		"total_sessions": total, "completed": completed, "failed": failed, "running": running,
		"avg_steps": avg_steps, "avg_duration": avg_duration, "success_rate": success_rate,
		"recent_tasks": recent_tasks,
	}


# ============================================================
# Settings APIs (Supabase-backed, per-user)
# ============================================================
def _get_user_settings(user_id: str) -> dict:
	"""Get user settings from Supabase, creating defaults if missing."""
	result = supabase.table("user_settings").select("*").eq("user_id", user_id).single().execute()
	if result.data:
		return result.data
	# Auto-create if missing
	supabase.table("user_settings").insert({"user_id": user_id}).execute()
	result = supabase.table("user_settings").select("*").eq("user_id", user_id).single().execute()
	return result.data or {}


@app.get("/api/settings")
async def get_settings(user_id: str = Depends(get_current_user)):
	settings = _get_user_settings(user_id)
	# Return only the relevant fields
	return {
		"default_model": settings.get("default_model", "gemini-2.5-flash"),
		"max_steps": settings.get("max_steps", 25),
		"use_vision": settings.get("use_vision", True),
		"headless": settings.get("headless", False),
		"max_actions_per_step": settings.get("max_actions_per_step", 5),
		"default_timeout": settings.get("default_timeout", 300),
		"google_api_key": settings.get("google_api_key", ""),
	}


VALID_SETTINGS_KEYS = {
	"default_model": str, "max_steps": int, "use_vision": bool, "headless": bool,
	"max_actions_per_step": int, "default_timeout": int, "google_api_key": str,
}

@app.put("/api/settings")
async def update_settings(data: dict, user_id: str = Depends(get_current_user)):
	updates = {}
	for key, expected_type in VALID_SETTINGS_KEYS.items():
		if key in data:
			value = data[key]
			if not isinstance(value, expected_type):
				raise HTTPException(status_code=400, detail=f"Invalid type for '{key}'")
			updates[key] = value

	if updates:
		updates["updated_at"] = datetime.now().isoformat()
		supabase.table("user_settings").update(updates).eq("user_id", user_id).execute()

	return await get_settings(user_id=user_id)


# ============================================================
# Agent Runner
# ============================================================
async def _run_agent(
	task_id: str,
	user_id: str,
	task: str,
	max_steps: int,
	model: str,
	file_paths: list[str],
	sample_images: list[ContentPartImageParam],
	settings: dict,
):
	task_data = running_tasks[task_id]
	start_time = datetime.now()
	browser = None

	try:
		api_key = settings.get("google_api_key") or os.getenv("GOOGLE_API_KEY")
		if not api_key:
			raise ValueError("Google API key not set. Configure it in Settings.")

		llm = ChatGoogle(model=model, api_key=api_key)

		is_production = os.getenv("FLY_APP_NAME") is not None
		browser = Browser(
			browser_profile=BrowserProfile(headless=is_production or settings.get("headless", False))
		)

		step_count = 0

		def on_step(browser_state, agent_output, step_num):
			nonlocal step_count
			step_count += 1
			step_info = {
				"type": "step",
				"step": step_count,
				"thinking": getattr(agent_output.current_state, 'thinking', '') or '',
				"evaluation": getattr(agent_output.current_state, 'evaluation_previous_goal', '') or '',
				"memory": getattr(agent_output.current_state, 'memory', '') or '',
				"next_goal": getattr(agent_output.current_state, 'next_goal', '') or '',
				"actions": [],
				"screenshot": None,
			}
			if agent_output.action:
				for action in agent_output.action:
					action_data = action.model_dump(exclude_none=True, exclude_unset=True)
					step_info["actions"].append(str(action_data))
			if browser_state and browser_state.screenshot:
				step_info["screenshot"] = browser_state.screenshot
			task_data["steps"].append(step_info)
			task_data["steps_count"] = step_count

		agent = Agent(
			task=task,
			llm=llm,
			browser=browser,
			use_vision=settings.get("use_vision", True),
			max_actions_per_step=settings.get("max_actions_per_step", 5),
			register_new_step_callback=on_step,
			available_file_paths=file_paths if file_paths else None,
			sample_images=sample_images if sample_images else None,
		)

		running_agents[task_id] = agent
		result = await agent.run(max_steps=max_steps)

		task_data["result"] = result.final_result() if result.final_result() else "Task completed."
		task_data["status"] = "done"
		task_data["duration"] = round((datetime.now() - start_time).total_seconds(), 1)

	except asyncio.CancelledError:
		task_data["error"] = "Stopped by user"
		task_data["status"] = "error"
		task_data["duration"] = round((datetime.now() - start_time).total_seconds(), 1)

	except Exception as e:
		logger.exception(f"Agent error for task {task_id}")
		task_data["error"] = str(e)
		task_data["status"] = "error"
		task_data["duration"] = round((datetime.now() - start_time).total_seconds(), 1)

	finally:
		running_agents.pop(task_id, None)
		running_asyncio_tasks.pop(task_id, None)
		if browser:
			try:
				await browser.stop()
			except Exception:
				pass

		# Persist to Supabase
		try:
			supabase.table("sessions").update({
				"status": task_data["status"],
				"result": task_data.get("result"),
				"error": task_data.get("error"),
				"steps_count": task_data.get("steps_count", 0),
				"duration": task_data.get("duration", 0),
			}).eq("id", task_id).execute()

			# Batch insert steps
			if task_data["steps"]:
				step_rows = [
					{
						"session_id": task_id,
						"user_id": user_id,
						"step_number": s["step"],
						"thinking": s.get("thinking", ""),
						"evaluation": s.get("evaluation", ""),
						"memory": s.get("memory", ""),
						"next_goal": s.get("next_goal", ""),
						"actions": s.get("actions", []),
						"screenshot": s.get("screenshot"),
					}
					for s in task_data["steps"]
				]
				supabase.table("session_steps").insert(step_rows).execute()
		except Exception:
			logger.exception(f"Failed to persist task {task_id} to Supabase")

		# Clean up in-memory
		running_tasks.pop(task_id, None)


# Mount static files AFTER all API routes
if STATIC_DIR.exists():
	app.mount("/assets", StaticFiles(directory=STATIC_DIR / "assets"), name="assets")

	@app.get("/{path:path}")
	async def spa_catchall(path: str):
		return FileResponse(STATIC_DIR / "index.html")

	@app.exception_handler(404)
	async def spa_fallback(request, exc):
		if not request.url.path.startswith("/api"):
			index = STATIC_DIR / "index.html"
			if index.exists():
				return FileResponse(index)
		return JSONResponse(status_code=404, content={"detail": "Not found"})


if __name__ == "__main__":
	import uvicorn
	port = int(os.getenv("PORT", 8000))
	uvicorn.run(app, host="0.0.0.0", port=port)
