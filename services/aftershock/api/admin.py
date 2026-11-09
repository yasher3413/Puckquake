"""The owner's admin page: pipeline status and the goal bot switch, behind a
password (``ADMIN_PASSWORD`` in the VM's ``.env``).

Signing in sets a signed, HttpOnly cookie scoped to ``/api/admin``. The
signing key is derived from the password, so changing the password signs
every session out. Nothing here is ever cached: the response cache skips
``/api/admin`` and every response says ``no-store``.
"""

from __future__ import annotations

import hashlib
import hmac
import time
from typing import Annotated, Any, Literal

from fastapi import APIRouter, Depends, HTTPException, Request, Response
from pydantic import BaseModel, Field
from sqlalchemy import desc, select
from sqlalchemy.ext.asyncio import AsyncSession

from aftershock.api import schemas as S

# app.py includes this router at its end, once these are defined.
from aftershock.api.app import db, health

COOKIE = "pq_admin"
COOKIE_PATH = "/api/admin"
SESSION_S = 7 * 86400
# Failed sign-ins allowed per address, and in total, per window.
LOGIN_LIMIT = 8
LOGIN_LIMIT_ALL = 60
LOGIN_WINDOW_S = 900
NO_STORE = {"Cache-Control": "no-store"}

router: APIRouter = APIRouter(prefix="/admin", include_in_schema=False)


class LoginIn(BaseModel):
    password: str = Field(max_length=256)


class BotModeIn(BaseModel):
    mode: Literal["off", "dry_run", "live"]


def _key(password: str) -> bytes:
    return hashlib.sha256(b"puckquake-admin:" + password.encode()).digest()


def _sign(password: str, expires: int) -> str:
    mac = hmac.new(_key(password), f"admin:{expires}".encode(), hashlib.sha256).hexdigest()
    return f"{expires}.{mac}"


def valid_session(password: str, token: str | None, now: float | None = None) -> bool:
    if not password or not token or "." not in token:
        return False
    expires, _, _mac = token.partition(".")
    if not expires.isdigit() or int(expires) < (now or time.time()):
        return False
    return hmac.compare_digest(_sign(password, int(expires)), token)


def _state(request: Request) -> Any:
    return request.app.state.aftershock


def _password(request: Request) -> str:
    password: str = _state(request).settings.admin_password
    if not password:
        raise HTTPException(503, "The admin page is not set up on this server.", headers=NO_STORE)
    return password


def require_admin(request: Request) -> None:
    if not valid_session(_password(request), request.cookies.get(COOKIE)):
        raise HTTPException(401, "Sign in to see this page.", headers=NO_STORE)


Admin = Annotated[None, Depends(require_admin)]


async def _count_failure(request: Request) -> None:
    from aftershock.api.scenarios import client_ip

    redis = _state(request).redis
    for key, limit in (
        (f"aftershock:admin-fails:{client_ip(request)}", LOGIN_LIMIT),
        ("aftershock:admin-fails:all", LOGIN_LIMIT_ALL),
    ):
        count = await redis.incr(key)
        if count == 1:
            await redis.expire(key, LOGIN_WINDOW_S)
        if count > limit:
            raise HTTPException(
                429, "Too many wrong passwords. Try again in 15 minutes.", headers=NO_STORE
            )


async def _locked(request: Request) -> bool:
    from aftershock.api.scenarios import client_ip

    redis = _state(request).redis
    mine = int(await redis.get(f"aftershock:admin-fails:{client_ip(request)}") or 0)
    every = int(await redis.get("aftershock:admin-fails:all") or 0)
    return mine >= LOGIN_LIMIT or every >= LOGIN_LIMIT_ALL


@router.post("/login", status_code=204)
async def login(body: LoginIn, request: Request) -> Response:
    password = _password(request)
    if await _locked(request):
        raise HTTPException(
            429, "Too many wrong passwords. Try again in 15 minutes.", headers=NO_STORE
        )
    if not hmac.compare_digest(body.password.encode(), password.encode()):
        await _count_failure(request)
        raise HTTPException(401, "That password is not right.", headers=NO_STORE)
    response = Response(status_code=204, headers=NO_STORE)
    response.set_cookie(
        COOKIE,
        _sign(password, int(time.time()) + SESSION_S),
        max_age=SESSION_S,
        path=COOKIE_PATH,
        httponly=True,
        secure=_state(request).settings.public_base_url.startswith("https://"),
        samesite="strict",
    )
    return response


@router.post("/logout", status_code=204)
async def logout() -> Response:
    response = Response(status_code=204, headers=NO_STORE)
    response.delete_cookie(COOKIE, path=COOKIE_PATH)
    return response


async def _bot(request: Request) -> S.BotInfo:
    from aftershock.bot.poster import SPEND_KEY, GoalBot

    st = _state(request)
    bot = GoalBot(st.settings, st.redis)
    month = bot.now().strftime("%Y-%m")
    return S.BotInfo(
        mode=await bot.mode(),
        keys_present=st.settings.x_keys_present,
        spent_millicents=int(await st.redis.get(SPEND_KEY.format(month=month)) or 0),
        cap_millicents=st.settings.x_bot_monthly_cap_millicents,
    )


@router.get("/status")
async def status(
    _: Admin,
    request: Request,
    session: Annotated[AsyncSession, Depends(db)],
) -> Response:
    from aftershock.db.models import JobRun, ReconcileEvent, SimRun

    h = await health(_state(request), session)
    runs = (await session.execute(select(SimRun).order_by(desc(SimRun.id)).limit(25))).scalars()
    rec = (
        await session.execute(select(ReconcileEvent).order_by(desc(ReconcileEvent.id)).limit(25))
    ).scalars()
    jobs = (await session.execute(select(JobRun).order_by(desc(JobRun.id)).limit(25))).scalars()
    out = S.AdminStatusResponse(
        health=h,
        sim_runs=[
            {
                "id": r.id,
                "created_at": r.created_at.isoformat(),
                "trigger": r.trigger,
                "n_sims": r.n_sims,
                "duration_ms": r.duration_ms,
            }
            for r in runs
        ],
        reconcile=[
            {"id": r.id, "created_at": r.created_at.isoformat(), "kind": r.kind, "detail": r.detail}
            for r in rec
        ],
        jobs=[S.JobRunOut.model_validate(j) for j in jobs],
        bot=await _bot(request),
    )
    return Response(out.model_dump_json(), media_type="application/json", headers=NO_STORE)


@router.post("/bot-mode")
async def bot_mode(_: Admin, body: BotModeIn, request: Request) -> Response:
    from aftershock.bot.poster import MODE_KEY

    await _state(request).redis.set(MODE_KEY, body.mode)
    info = await _bot(request)
    return Response(info.model_dump_json(), media_type="application/json", headers=NO_STORE)
