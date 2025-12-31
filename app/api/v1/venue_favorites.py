from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.api.deps import get_band_or_404, get_current_user, get_venue_or_404
from app.database import get_db
from app.models import Band, User, Venue
from app.models.venue_favorite import VenueFavorite

router = APIRouter()


@router.post(
    "/bands/{band_id}/venues/{venue_id}/favorite",
    status_code=status.HTTP_201_CREATED,
)
def favorite_venue(
    band_id: int,
    venue_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Favorite a venue for a band.
    
    Only band members can favorite venues for their band.
    """
    band = get_band_or_404(band_id, db)
    
    # Verify user is a member of the band
    is_member = any(member.user_id == current_user.id for member in band.members)
    if not is_member:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You must be a member of this band to favorite venues",
        )
    
    # Verify venue exists
    venue = get_venue_or_404(venue_id, db)
    
    # Check if already favorited
    existing_favorite = (
        db.query(VenueFavorite)
        .filter(VenueFavorite.band_id == band_id, VenueFavorite.venue_id == venue_id)
        .first()
    )
    
    if existing_favorite:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Venue is already favorited",
        )
    
    # Create favorite
    favorite = VenueFavorite(band_id=band_id, venue_id=venue_id)
    db.add(favorite)
    db.commit()
    db.refresh(favorite)
    
    return {"message": "Venue favorited successfully", "favorite_id": favorite.id}


@router.delete(
    "/bands/{band_id}/venues/{venue_id}/favorite",
    status_code=status.HTTP_200_OK,
)
def unfavorite_venue(
    band_id: int,
    venue_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Unfavorite a venue for a band.
    
    Only band members can unfavorite venues for their band.
    """
    band = get_band_or_404(band_id, db)
    
    # Verify user is a member of the band
    is_member = any(member.user_id == current_user.id for member in band.members)
    if not is_member:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You must be a member of this band to unfavorite venues",
        )
    
    # Find and delete favorite
    favorite = (
        db.query(VenueFavorite)
        .filter(VenueFavorite.band_id == band_id, VenueFavorite.venue_id == venue_id)
        .first()
    )
    
    if not favorite:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Venue is not favorited",
        )
    
    db.delete(favorite)
    db.commit()
    
    return {"message": "Venue unfavorited successfully"}


@router.get(
    "/bands/{band_id}/favorite-venues",
    status_code=status.HTTP_200_OK,
)
def get_favorite_venues(
    band_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Get all favorited venues for a band.
    
    Only band members can view favorite venues for their band.
    """
    band = get_band_or_404(band_id, db)
    
    # Verify user is a member of the band
    is_member = any(member.user_id == current_user.id for member in band.members)
    if not is_member:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You must be a member of this band to view favorite venues",
        )
    
    # Get all favorites for this band
    favorites = (
        db.query(VenueFavorite)
        .filter(VenueFavorite.band_id == band_id)
        .join(Venue)
        .all()
    )
    
    venue_ids = [favorite.venue_id for favorite in favorites]
    
    return {"venue_ids": venue_ids, "count": len(venue_ids)}


@router.get(
    "/bands/{band_id}/venues/{venue_id}/is-favorited",
    status_code=status.HTTP_200_OK,
)
def is_venue_favorited(
    band_id: int,
    venue_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Check if a venue is favorited by a band.
    
    Only band members can check favorite status.
    """
    band = get_band_or_404(band_id, db)
    
    # Verify user is a member of the band
    is_member = any(member.user_id == current_user.id for member in band.members)
    if not is_member:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You must be a member of this band to check favorite status",
        )
    
    # Check if favorited
    favorite = (
        db.query(VenueFavorite)
        .filter(VenueFavorite.band_id == band_id, VenueFavorite.venue_id == venue_id)
        .first()
    )
    
    return {"is_favorited": favorite is not None}

