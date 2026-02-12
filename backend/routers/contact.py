from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy import select



router = APIRouter(
    prefix="/api/contact",
    tags=["contact"],
)

@router.post("/send/message")
def send_message():
    return {"success": True}