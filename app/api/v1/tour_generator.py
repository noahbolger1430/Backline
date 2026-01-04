"""
Tour Generator API

Endpoints for generating optimized tour schedules for bands.
"""

from datetime import date, timedelta
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.api.deps import check_band_permission, get_band_or_404, get_current_active_user, get_venue_or_404
from app.database import get_db
from app.models import Band, BandAvailability, BandRole, User, SavedTour, Venue
from app.schemas.tour_generator import (
    AlgorithmWeights,
    TourGeneratorRequest,
    TourGeneratorResponse,
    TourEventRecommendation,
    TourVenueRecommendation,
    SaveTourRequest,
    SaveTourRequestWithData,
    SavedTourSummary,
    SavedTourDetail,
    VenueSwapDistanceRequest,
    VenueSwapDistanceResponse,
)

from app.services.availability_service import AvailabilityService
from app.services.tour_generator_service import (
    AlgorithmWeightsConfig,
    TourGeneratorParams,
    TourGeneratorService,
)
from app.services.tour_generator_geocoding_utils import (
    build_location_string,
    estimate_distance_from_location,
    calculate_distance_between_venues,
)

router = APIRouter()


@router.post("/bands/{band_id}/generate-tour", response_model=TourGeneratorResponse)
def generate_tour(
    band_id: int,
    tour_request: TourGeneratorRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
) -> TourGeneratorResponse:
    """
    Generate an optimized tour schedule for a band.
    
    Analyzes band availability, venue locations, event opportunities, and
    recommendation scores to create a tour itinerary with recommended events 
    to apply for and venues to contact for direct bookings.
    
    **Parameters:**
    - **band_id**: ID of the band
    - **tour_request**: Tour generation parameters
        - **start_date**: Tour start date
        - **end_date**: Tour end date  
        - **tour_radius_km**: Maximum tour radius in kilometers
        - **starting_location**: Starting city/state (optional)
        - **ending_location**: Ending city/state (optional)
        - **min_days_between_shows**: Minimum days between performances (default: 0)
        - **max_days_between_shows**: Maximum days between performances (default: 7)
        - **max_drive_hours_per_day**: Maximum driving hours per day (default: 8)
        - **preferred_genres**: List of preferred genres (optional)
        - **preferred_venue_capacity_min**: Minimum venue capacity (optional)
        - **preferred_venue_capacity_max**: Maximum venue capacity (optional)
        - **prioritize_weekends**: Prioritize weekend dates (default: true)
        - **avoid_venue_ids**: List of venue IDs to avoid (optional)
        - **algorithm_weights**: Custom algorithm weights for scoring (optional)
    
    **Returns:**
    - **200 OK**: Tour generation results including:
        - **recommended_events**: Prioritized list of events to apply for with recommendation scores
        - **recommended_venues**: Venues to contact for direct bookings
        - **tour_summary**: Overall tour metrics and efficiency
        - **availability_conflicts**: Any date conflicts found
        - **routing_warnings**: Warnings about long drives or gaps
    
    **Permissions:**
    - Band owners, admins, and members can generate tours
    
    **Algorithm considers:**
    - Band member availability
    - Event recommendation scores (genre matching, past success, similar bands)
    - Geographic routing efficiency  
    - Weekend prioritization
    - Travel time between venues
    - Existing events vs direct bookings
    - Favorited venues
    - Collaborative filtering (similar bands' success)
    - User-configured algorithm weights
    """
    band = get_band_or_404(band_id, db)
    check_band_permission(band, current_user, [BandRole.OWNER, BandRole.ADMIN, BandRole.MEMBER])
    
    if tour_request.end_date < tour_request.start_date:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="End date must be after start date"
        )
    
    if (tour_request.end_date - tour_request.start_date).days > 365:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Tour duration cannot exceed 365 days"
        )
    
    if tour_request.start_date < date.today():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Tour start date cannot be in the past"
        )
    
    algorithm_weights_config = None
    if tour_request.algorithm_weights:
        algorithm_weights_config = AlgorithmWeightsConfig(
            genre_match_weight=tour_request.algorithm_weights.genre_match_weight,
            capacity_match_weight=tour_request.algorithm_weights.capacity_match_weight,
            distance_weight=tour_request.algorithm_weights.distance_weight,
            weekend_preference_weight=tour_request.algorithm_weights.weekend_preference_weight,
            recommendation_score_weight=tour_request.algorithm_weights.recommendation_score_weight,
        )
    
    params = TourGeneratorParams(
        band_id=band_id,
        start_date=tour_request.start_date,
        end_date=tour_request.end_date,
        tour_radius_km=tour_request.tour_radius_km,
        starting_location=tour_request.starting_location,
        ending_location=tour_request.ending_location,
        min_days_between_shows=tour_request.min_days_between_shows,
        max_days_between_shows=tour_request.max_days_between_shows,
        max_drive_hours_per_day=tour_request.max_drive_hours_per_day,
        preferred_genres=tour_request.preferred_genres,
        preferred_venue_capacity_min=tour_request.preferred_venue_capacity_min,
        preferred_venue_capacity_max=tour_request.preferred_venue_capacity_max,
        prioritize_weekends=tour_request.prioritize_weekends,
        include_booked_events=tour_request.include_booked_events,
        avoid_venue_ids=tour_request.avoid_venue_ids,
        algorithm_weights=algorithm_weights_config,
    )
    
    result = TourGeneratorService.generate_tour(db, params)
    
    event_recommendations = [
        TourEventRecommendation(**event_data)
        for event_data in result.recommended_events
    ]
    
    venue_recommendations = [
        TourVenueRecommendation(**venue_data)
        for venue_data in result.recommended_venues
    ]
    
    tour_summary = {
        'total_distance_km': round(result.total_distance_km, 1),
        'total_travel_days': result.total_travel_days,
        'total_show_days': result.total_show_days,
        'tour_efficiency_score': round(result.tour_efficiency_score, 1),
        'average_km_between_shows': round(
            result.total_distance_km / result.total_show_days, 1
        ) if result.total_show_days > 0 else 0,
        'recommended_events_count': len(event_recommendations),
        'recommended_venues_count': len(venue_recommendations),
    }
    
    return TourGeneratorResponse(
        band_id=band_id,
        band_name=band.name,
        tour_parameters={
            'start_date': tour_request.start_date.isoformat(),
            'end_date': tour_request.end_date.isoformat(),
            'tour_radius_km': tour_request.tour_radius_km,
            'starting_location': tour_request.starting_location,
            'ending_location': tour_request.ending_location,
        },
        recommended_events=event_recommendations,
        recommended_venues=venue_recommendations,
        tour_summary=tour_summary,
        availability_conflicts=result.availability_conflicts,
        booked_events=result.booked_events,
        routing_warnings=result.routing_warnings,
    )


@router.post("/bands/{band_id}/tours/{tour_id}/save", status_code=status.HTTP_201_CREATED)
def save_tour(
    band_id: int,
    tour_id: str,  # This will be a temporary ID from the frontend
    request: SaveTourRequestWithData,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
) -> SavedTourDetail:
    """
    Save a generated tour for future reference.
    
    **Parameters:**
    - **band_id**: ID of the band
    - **tour_id**: Temporary tour ID from frontend
    - **request**: Request containing save_request (name) and tour_data (full tour results)
    
    **Returns:**
    - **201 Created**: Saved tour details
    
    **Permissions:**
    - Band owners, admins, and members can save tours
    """
    band = get_band_or_404(band_id, db)
    check_band_permission(band, current_user, [BandRole.OWNER, BandRole.ADMIN, BandRole.MEMBER])
    
    save_request = request.save_request
    tour_data = request.tour_data
    
    # Extract parameters from tour data
    start_date = date.fromisoformat(tour_data.tour_parameters['start_date'])
    end_date = date.fromisoformat(tour_data.tour_parameters['end_date'])
    
    # Create saved tour
    saved_tour = SavedTour(
        band_id=band_id,
        name=save_request.name,
        start_date=start_date,
        end_date=end_date,
        tour_radius_km=tour_data.tour_parameters['tour_radius_km'],
        starting_location=tour_data.tour_parameters.get('starting_location'),
        tour_data=tour_data.model_dump(),
        tour_params=tour_data.tour_parameters,
    )
    
    db.add(saved_tour)
    db.commit()
    db.refresh(saved_tour)
    
    return SavedTourDetail(
        id=saved_tour.id,
        band_id=saved_tour.band_id,
        name=saved_tour.name,
        start_date=saved_tour.start_date,
        end_date=saved_tour.end_date,
        tour_radius_km=saved_tour.tour_radius_km,
        starting_location=saved_tour.starting_location,
        tour_data=saved_tour.tour_data,
        tour_params=saved_tour.tour_params,
        created_at=saved_tour.created_at,
        updated_at=saved_tour.updated_at,
        tour_results=TourGeneratorResponse(**saved_tour.tour_data),
    )


@router.get("/bands/{band_id}/tours", response_model=List[SavedTourSummary])
def list_saved_tours(
    band_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
) -> List[SavedTourSummary]:
    """
    List all saved tours for a band.
    
    **Parameters:**
    - **band_id**: ID of the band
    
    **Returns:**
    - **200 OK**: List of saved tour summaries
    
    **Permissions:**
    - Band members can view saved tours
    """
    band = get_band_or_404(band_id, db)
    check_band_permission(band, current_user, [BandRole.OWNER, BandRole.ADMIN, BandRole.MEMBER])
    
    saved_tours = (
        db.query(SavedTour)
        .filter(SavedTour.band_id == band_id)
        .order_by(SavedTour.created_at.desc())
        .all()
    )
    
    summaries = []
    for tour in saved_tours:
        tour_data = tour.tour_data
        total_shows = tour_data.get('tour_summary', {}).get('total_show_days', 0)
        total_distance = tour_data.get('tour_summary', {}).get('total_distance_km', 0)
        
        summaries.append(
            SavedTourSummary(
                id=tour.id,
                name=tour.name,
                start_date=tour.start_date,
                end_date=tour.end_date,
                tour_radius_km=tour.tour_radius_km,
                starting_location=tour.starting_location,
                created_at=tour.created_at,
                total_shows=total_shows,
                total_distance_km=total_distance,
            )
        )
    
    return summaries


@router.get("/bands/{band_id}/tours/{tour_id}", response_model=SavedTourDetail)
def get_saved_tour(
    band_id: int,
    tour_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
) -> SavedTourDetail:
    """
    Get details of a specific saved tour.
    
    **Parameters:**
    - **band_id**: ID of the band
    - **tour_id**: ID of the saved tour
    
    **Returns:**
    - **200 OK**: Saved tour details with full tour results
    
    **Permissions:**
    - Band members can view saved tours
    """
    band = get_band_or_404(band_id, db)
    check_band_permission(band, current_user, [BandRole.OWNER, BandRole.ADMIN, BandRole.MEMBER])
    
    saved_tour = (
        db.query(SavedTour)
        .filter(SavedTour.id == tour_id, SavedTour.band_id == band_id)
        .first()
    )
    
    if not saved_tour:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Saved tour not found"
        )
    
    return SavedTourDetail(
        id=saved_tour.id,
        band_id=saved_tour.band_id,
        name=saved_tour.name,
        start_date=saved_tour.start_date,
        end_date=saved_tour.end_date,
        tour_radius_km=saved_tour.tour_radius_km,
        starting_location=saved_tour.starting_location,
        tour_data=saved_tour.tour_data,
        tour_params=saved_tour.tour_params,
        created_at=saved_tour.created_at,
        updated_at=saved_tour.updated_at,
        tour_results=TourGeneratorResponse(**saved_tour.tour_data),
    )


@router.put("/bands/{band_id}/tours/{tour_id}", response_model=SavedTourDetail)
def update_saved_tour(
    band_id: int,
    tour_id: int,
    request: SaveTourRequestWithData,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
) -> SavedTourDetail:
    """
    Update an existing saved tour.
    
    **Parameters:**
    - **band_id**: ID of the band
    - **tour_id**: ID of the saved tour to update
    - **request**: Request containing save_request (name) and tour_data (full tour results)
    
    **Returns:**
    - **200 OK**: Updated saved tour details
    
    **Permissions:**
    - Band owners, admins, and members can update saved tours
    """
    band = get_band_or_404(band_id, db)
    check_band_permission(band, current_user, [BandRole.OWNER, BandRole.ADMIN, BandRole.MEMBER])
    
    saved_tour = (
        db.query(SavedTour)
        .filter(SavedTour.id == tour_id, SavedTour.band_id == band_id)
        .first()
    )
    
    if not saved_tour:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Saved tour not found"
        )
    
    save_request = request.save_request
    tour_data = request.tour_data
    
    # Extract parameters from tour data
    start_date = date.fromisoformat(tour_data.tour_parameters['start_date'])
    end_date = date.fromisoformat(tour_data.tour_parameters['end_date'])
    
    # Update saved tour
    saved_tour.name = save_request.name
    saved_tour.start_date = start_date
    saved_tour.end_date = end_date
    saved_tour.tour_radius_km = tour_data.tour_parameters['tour_radius_km']
    saved_tour.starting_location = tour_data.tour_parameters.get('starting_location')
    saved_tour.tour_data = tour_data.model_dump()
    saved_tour.tour_params = tour_data.tour_parameters
    
    db.commit()
    db.refresh(saved_tour)
    
    return SavedTourDetail(
        id=saved_tour.id,
        band_id=saved_tour.band_id,
        name=saved_tour.name,
        start_date=saved_tour.start_date,
        end_date=saved_tour.end_date,
        tour_radius_km=saved_tour.tour_radius_km,
        starting_location=saved_tour.starting_location,
        tour_data=saved_tour.tour_data,
        tour_params=saved_tour.tour_params,
        created_at=saved_tour.created_at,
        updated_at=saved_tour.updated_at,
        tour_results=TourGeneratorResponse(**saved_tour.tour_data),
    )


@router.delete("/bands/{band_id}/tours/{tour_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_saved_tour(
    band_id: int,
    tour_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """
    Delete a saved tour.
    
    **Parameters:**
    - **band_id**: ID of the band
    - **tour_id**: ID of the saved tour
    
    **Returns:**
    - **204 No Content**: Tour deleted successfully
    
    **Permissions:**
    - Band owners and admins can delete saved tours
    """
    band = get_band_or_404(band_id, db)
    check_band_permission(band, current_user, [BandRole.OWNER, BandRole.ADMIN])
    
    saved_tour = (
        db.query(SavedTour)
        .filter(SavedTour.id == tour_id, SavedTour.band_id == band_id)
        .first()
    )
    
    if not saved_tour:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Saved tour not found"
        )
    
    db.delete(saved_tour)
    db.commit()


@router.get("/bands/{band_id}/tour-availability-summary")
def get_tour_availability_summary(
    band_id: int,
    start_date: date = Query(..., description="Start date for availability check"),
    end_date: date = Query(..., description="End date for availability check"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
) -> dict:
    """
    Get a summary of band availability for tour planning.
    
    Provides a quick overview of available, unavailable, and tentative dates
    within a date range to help with tour planning.
    
    **Parameters:**
    - **band_id**: ID of the band
    - **start_date**: Start of date range
    - **end_date**: End of date range
    
    **Returns:**
    - **200 OK**: Availability summary including:
        - **total_days**: Total days in range
        - **available_days**: Number of fully available days
        - **unavailable_days**: Number of unavailable days
        - **tentative_days**: Number of tentative days
        - **blocked_by_events**: Days blocked by existing bookings
        - **weekend_availability**: Availability on weekends
    
    **Permissions:**
    - Band members can view availability
    """
    band = get_band_or_404(band_id, db)
    check_band_permission(band, current_user, [BandRole.OWNER, BandRole.ADMIN, BandRole.MEMBER])
    
    if end_date < start_date:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="End date must be after start date"
        )
    
    current_date = start_date
    total_days = 0
    available_days = 0
    unavailable_days = 0
    tentative_days = 0
    blocked_by_events = 0
    weekend_available = 0
    weekend_total = 0
    
    while current_date <= end_date:
        total_days += 1
        
        is_available, member_details = AvailabilityService.get_band_effective_availability(
            db, band, current_date
        )
        
        band_block = (
            db.query(BandAvailability)
            .filter(
                BandAvailability.band_id == band_id,
                BandAvailability.date == current_date
            )
            .first()
        )
        
        if band_block and band_block.band_event_id:
            blocked_by_events += 1
            unavailable_days += 1
        elif is_available:
            available_days += 1
            if current_date.weekday() in [4, 5, 6]:
                weekend_available += 1
        else:
            tentative_count = sum(
                1 for m in member_details 
                if m.status.value == "tentative"
            )
            if tentative_count > 0:
                tentative_days += 1
            else:
                unavailable_days += 1
        
        if current_date.weekday() in [4, 5, 6]:
            weekend_total += 1
        
        current_date += timedelta(days=1)
    
    return {
        'band_id': band_id,
        'band_name': band.name,
        'date_range': {
            'start_date': start_date.isoformat(),
            'end_date': end_date.isoformat(),
        },
        'availability_summary': {
            'total_days': total_days,
            'available_days': available_days,
            'unavailable_days': unavailable_days,
            'tentative_days': tentative_days,
            'blocked_by_events': blocked_by_events,
            'availability_percentage': round(
                (available_days / total_days * 100) if total_days > 0 else 0, 1
            ),
        },
        'weekend_availability': {
            'weekend_available': weekend_available,
            'weekend_total': weekend_total,
            'weekend_availability_percentage': round(
                (weekend_available / weekend_total * 100) if weekend_total > 0 else 0, 1
            ),
        }
    }

@router.post("/calculate-venue-swap-distance", response_model=VenueSwapDistanceResponse)
def calculate_venue_swap_distance(
    request: VenueSwapDistanceRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
) -> VenueSwapDistanceResponse:
    """
    Calculate distances for a venue swap in a tour.
    
    This endpoint calculates the appropriate distances when swapping a venue
    in a generated tour, following the same logic as the tour generator:
    
    - **distance_from_home_km**: Distance from band's home location to the new venue
    - **distance_from_previous_km**: The effective travel distance, which is:
        - If previous show is 2 days or less before: min(venue-to-venue, home-and-back)
        - If previous show is more than 2 days before: distance from home
    - **distance_to_next_km**: Distance to the next venue (for tour summary updates)
    - **travel_days_needed**: Estimated travel days based on distance
    
    **Parameters:**
    - **band_id**: ID of the band (to get home location)
    - **new_venue_id**: ID of the venue being swapped in
    - **suggested_date**: Date of the tour stop
    - **previous_stop_venue_id**: ID of the previous stop's venue (optional)
    - **previous_stop_date**: Date of the previous stop (optional)
    - **next_stop_venue_id**: ID of the next stop's venue (optional)
    - **next_stop_date**: Date of the next stop (optional)
    
    **Returns:**
    - Distance calculations and routing notes
    
    **Permissions:**
    - Any authenticated user can calculate distances
    """
    # Get the band to find home location
    band = get_band_or_404(request.band_id, db)
    check_band_permission(band, current_user, [BandRole.OWNER, BandRole.ADMIN, BandRole.MEMBER])
    
    # Get the new venue
    new_venue = get_venue_or_404(request.new_venue_id, db)
    new_venue_location = build_location_string(venue=new_venue)
    
    # Determine home location (band location or city/state)
    home_location = None
    if band.location:
        home_location = band.location
    elif band.city and band.state:
        home_location = f"{band.city}, {band.state}"
    elif band.city:
        home_location = band.city
    
    # Constants from tour generator service
    AVERAGE_DRIVING_SPEED_KMH = 80.0
    MAX_DRIVE_HOURS_PER_DAY = 8.0  # Default, could be parameterized
    
    # Calculate distance from home
    distance_from_home = 0.0
    if home_location:
        distance_from_home = estimate_distance_from_location(
            home_location,
            new_venue_location
        )
    
    # Calculate distance from previous stop
    distance_from_previous = distance_from_home  # Default to home distance
    routing_note = "Travel from home location"
    
    if request.previous_stop_venue_id and request.previous_stop_date:
        previous_venue = db.query(Venue).filter(Venue.id == request.previous_stop_venue_id).first()
        
        if previous_venue:
            # Calculate days between shows
            days_between = (request.suggested_date - request.previous_stop_date).days
            
            # Calculate venue-to-venue distance
            distance_from_prev_venue = calculate_distance_between_venues(
                previous_venue,
                new_venue
            )
            
            # Calculate distance from previous venue to home
            prev_venue_to_home = 0.0
            if home_location:
                prev_venue_location = build_location_string(venue=previous_venue)
                prev_venue_to_home = estimate_distance_from_location(
                    prev_venue_location,
                    home_location
                )
            
            # Apply the same logic as tour generator:
            # For consecutive shows (1-2 days apart), use venue-to-venue if shorter than round-trip home
            # For shows 3+ days apart, assume band goes home between shows
            if days_between <= 2:
                # Consecutive shows - compare distances
                distance_home_and_back = prev_venue_to_home + distance_from_home
                
                if distance_from_prev_venue < distance_home_and_back:
                    # More efficient to go directly between venues
                    distance_from_previous = distance_from_prev_venue
                    routing_note = f"Direct travel from previous venue ({days_between} day{'s' if days_between != 1 else ''} between shows)"
                else:
                    # More efficient to go home between shows
                    distance_from_previous = distance_from_home
                    routing_note = f"Travel from home location (shorter than direct route)"
            else:
                # Shows are far apart - assume band goes home
                distance_from_previous = distance_from_home
                routing_note = f"Travel from home location ({days_between} days between shows)"
    
    # Calculate distance to next stop (for tour summary updates)
    distance_to_next = 0.0
    if request.next_stop_venue_id:
        next_venue = db.query(Venue).filter(Venue.id == request.next_stop_venue_id).first()
        if next_venue:
            # Calculate days to next show
            if request.next_stop_date:
                days_to_next = (request.next_stop_date - request.suggested_date).days
                
                if days_to_next <= 2:
                    # Consecutive shows - use venue-to-venue
                    distance_to_next = calculate_distance_between_venues(new_venue, next_venue)
                else:
                    # Band goes home - next stop's distance_from_previous will be recalculated from home
                    # Return 0 to indicate this doesn't affect immediate routing
                    distance_to_next = 0.0
            else:
                distance_to_next = calculate_distance_between_venues(new_venue, next_venue)
    
    # Calculate travel days needed
    driving_hours = distance_from_previous / AVERAGE_DRIVING_SPEED_KMH
    travel_days_needed = max(0, int(driving_hours / MAX_DRIVE_HOURS_PER_DAY))
    
    return VenueSwapDistanceResponse(
        distance_from_home_km=round(distance_from_home, 1),
        distance_from_previous_km=round(distance_from_previous, 1),
        distance_to_next_km=round(distance_to_next, 1),
        travel_days_needed=travel_days_needed,
        routing_note=routing_note
    )