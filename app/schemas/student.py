from pydantic import BaseModel, ConfigDict
from typing import Optional
from datetime import datetime

class StudentCreate(BaseModel):
    name: str
    age: int
    dept: str
    email: str
    phone: str
    address: str

class StudentUpdate(BaseModel):
    name: Optional[str]=None
    age: Optional[int]=None
    dept: Optional[str]=None
    email: Optional[str]=None
    phone: Optional[str]=None
    address: Optional[str]=None

class StudentResponse(BaseModel):
    id:int
    created_at:datetime
    name: str
    age: int
    dept: str
    email: str
    phone: str
    address: str
    model_config = ConfigDict(from_attributes=True) 