from fastapi import APIRouter

from app.api.v1 import (
    auth,
    availability,
    bands,
    band_events,
    equipment,
    event_applications,
    events,
    notifications,
    physical_tickets,
    recommendations,
    rehearsals,
    setlists,
    stage_plots,
    tour_generator,
    users,
    venue_availability,
    venue_favorites,
    venue_recommendations,
    venues,
    youtube,
)

api_router = APIRouter()

# #region agent log
import json
log_path = r"c:\Users\Noah\CursorProjects\Backline\.cursor\debug.log"
try:
    with open(log_path, "a", encoding="utf-8") as f:
        f.write(json.dumps({"location":"__init__.py:15","message":"Checking registered routers","data":{"has_rehearsals":True,"registered_routers":["auth","users","bands","venues","events","availability","notifications","venue_recommendations","tour_generator","rehearsals"]},"timestamp":int(__import__("time").time()*1000),"sessionId":"debug-session","runId":"post-fix","hypothesisId":"A"}) + "\n")
except: pass
# #endregion

api_router.include_router(auth.router, prefix="/auth", tags=["auth"])
api_router.include_router(users.router, prefix="/users", tags=["users"])
api_router.include_router(bands.router, prefix="/bands", tags=["bands"])
api_router.include_router(venues.router, prefix="/venues", tags=["venues"])
api_router.include_router(events.router, prefix="/events", tags=["events"])
api_router.include_router(band_events.router, prefix="/band-events", tags=["band-events"])
api_router.include_router(availability.router, prefix="/availability", tags=["availability"])
api_router.include_router(venue_recommendations.router, prefix="/recommendations", tags=["venue-recommendations"])
api_router.include_router(tour_generator.router, prefix="/tours", tags=["tours"])
# Rehearsals router routes already include /bands/{band_id}/ prefix, so include without additional prefix
api_router.include_router(rehearsals.router, tags=["rehearsals"])
# Notifications router routes already include /notifications prefix, so include without additional prefix
api_router.include_router(notifications.router, tags=["notifications"])
# Event applications router - include with prefix to match frontend expectations
api_router.include_router(event_applications.router, prefix="/event-applications", tags=["event-applications"])
# Recommendations router - include with prefix to match frontend expectations
api_router.include_router(recommendations.router, prefix="/recommendations", tags=["recommendations"])
# Equipment router
api_router.include_router(equipment.router, prefix="/equipment", tags=["equipment"])
# Physical tickets router
api_router.include_router(physical_tickets.router, prefix="/physical-tickets", tags=["physical-tickets"])
# Setlists router
api_router.include_router(setlists.router, prefix="/setlists", tags=["setlists"])
# Stage plots router
api_router.include_router(stage_plots.router, prefix="/stage-plots", tags=["stage-plots"])
# Venue availability router - merge with venues router using /venues prefix
api_router.include_router(venue_availability.router, prefix="/venues", tags=["venues"])
# Venue favorites router routes already include full path, so include without additional prefix
api_router.include_router(venue_favorites.router, tags=["venue-favorites"])
# YouTube router
api_router.include_router(youtube.router, prefix="/youtube", tags=["youtube"])
