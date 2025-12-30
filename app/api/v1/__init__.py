from fastapi import APIRouter

from app.api.v1 import availability, auth, bands, event_applications, events, notifications, users, venue_availability, venues, stage_plots, setlists, rehearsals

api_router = APIRouter()

api_router.include_router(auth.router, prefix="/auth", tags=["authentication"])
api_router.include_router(users.router, prefix="/users", tags=["users"])
api_router.include_router(bands.router, prefix="/bands", tags=["bands"])
api_router.include_router(venue_availability.router, prefix="/venues", tags=["venue-availability"])
api_router.include_router(venues.router, prefix="/venues", tags=["venues"])
api_router.include_router(availability.router, prefix="/availability", tags=["availability"])
api_router.include_router(events.router, prefix="/events", tags=["events"])
api_router.include_router(event_applications.router, prefix="/event-applications", tags=["event-applications"])
api_router.include_router(notifications.router, prefix="", tags=["notifications"])
api_router.include_router(stage_plots.router, prefix="/stage-plots", tags=["stage-plots"])
api_router.include_router(setlists.router, prefix="/setlists", tags=["setlists"])
api_router.include_router(rehearsals.router, prefix="", tags=["rehearsals"])
