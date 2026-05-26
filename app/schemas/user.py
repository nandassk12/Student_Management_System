from pydantic import BaseModel, ConfigDict
from typing import Optional
from datetime import datetime

class UserCreate(BaseModel):
    username: str
    email: str
    password:str

class UserLogin(BaseModel):
    username: str
    password: str

class UserResponse(BaseModel):
    id:int
    username: str
    email: str
    model_config = ConfigDict(from_attributes=True) 