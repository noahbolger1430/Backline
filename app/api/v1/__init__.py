from fastapi import APIRouter

from app.api.v1 import availability, auth, bands, event_applications, events, users, venue_availability, venues

api_router = APIRouter()

api_router.include_router(auth.router, prefix="/auth", tags=["authentication"])
api_router.include_router(users.router, prefix="/users", tags=["users"])
api_router.include_router(bands.router, prefix="/bands", tags=["bands"])
api_router.include_router(venue_availability.router, prefix="/venues", tags=["venue-availability"])
api_router.include_router(venues.router, prefix="/venues", tags=["venues"])
api_router.include_router(availability.router, prefix="/availability", tags=["availability"])
api_router.include_router(events.router, prefix="/events", tags=["events"])
api_router.include_router(event_applications.router, prefix="/applications", tags=["event-applications"])

