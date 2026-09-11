from sqlalchemy import Column, Integer, String, Text, Numeric, ForeignKey, DateTime
from sqlalchemy.sql import func
from database import Base


class Location(Base):
    __tablename__ = "locations"

    id = Column(Integer, primary_key=True)
    name = Column(String(150), nullable=False)
    latitude = Column(Numeric(10, 7))
    longitude = Column(Numeric(10, 7))
    created_at = Column(DateTime, server_default=func.now())


class Camera(Base):
    __tablename__ = "cameras"

    id = Column(Integer, primary_key=True)
    location_id = Column(Integer, ForeignKey("locations.id"), nullable=False)
    camera_name = Column(String(100), nullable=False)
    camera_source = Column(String(255))
    status = Column(String(20), default="ACTIVE")
    created_at = Column(DateTime, server_default=func.now())


class DetectionEvent(Base):
    __tablename__ = "detection_events"

    id = Column(Integer, primary_key=True)
    camera_id = Column(Integer, ForeignKey("cameras.id"), nullable=False)
    timestamp = Column(DateTime, server_default=func.now())
    total_people = Column(Integer, default=0)
    male_count = Column(Integer, default=0)
    female_count = Column(Integer, default=0)


class AlertType(Base):
    __tablename__ = "alert_types"

    id = Column(Integer, primary_key=True)
    name = Column(String(50), unique=True, nullable=False)
    description = Column(Text)
    severity = Column(String(20), nullable=False)


class Alert(Base):
    __tablename__ = "alerts"

    id = Column(Integer, primary_key=True)
    camera_id = Column(Integer, ForeignKey("cameras.id"), nullable=True)
    alert_type_id = Column(Integer, ForeignKey("alert_types.id"), nullable=True)
    timestamp = Column(DateTime, server_default=func.now())
    severity = Column(String(20), nullable=False)
    confidence = Column(Numeric(5, 4))
    status = Column(String(20), default="ACTIVE")
    description = Column(Text)


class Hotspot(Base):
    __tablename__ = "hotspots"

    id = Column(Integer, primary_key=True)
    location_id = Column(Integer, ForeignKey("locations.id"), nullable=False)
    alert_count = Column(Integer, default=0)
    risk_score = Column(Numeric(5, 2), default=0)
    risk_level = Column(String(20), default="LOW")
    last_calculated = Column(DateTime, server_default=func.now())