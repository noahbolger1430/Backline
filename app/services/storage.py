"""
Google Cloud Storage service for handling file uploads.
"""
import os
import json
import uuid
from pathlib import Path
from typing import Optional
from google.cloud import storage
from google.cloud.exceptions import GoogleCloudError
from fastapi import HTTPException, UploadFile

from app.config import get_settings

settings = get_settings()


class StorageService:
    """
    Service for managing file uploads to Google Cloud Storage.
    """
    
    def __init__(self):
        """
        Initialize the storage client.
        
        The client will automatically use the credentials from:
        1. GOOGLE_APPLICATION_CREDENTIALS environment variable (path to JSON key file)
        2. Default credentials if running on GCP
        """
        self.client = None
        self.images_bucket = None
        self.files_bucket = None
        
        # Only initialize if GCP is configured
        if settings.gcp_project_id and settings.gcp_images_bucket:
            creds_path = self._setup_credentials()
            
            if not creds_path:
                print("Warning: Could not set up GCP credentials")
                print("Falling back to local file storage")
                return
            
            # Set absolute path in environment (Google Cloud libraries require this)
            os.environ["GOOGLE_APPLICATION_CREDENTIALS"] = str(creds_path)
            
            try:
                self.client = storage.Client(project=settings.gcp_project_id)
                self.images_bucket = self.client.bucket(settings.gcp_images_bucket)
                
                # Use separate bucket for files if configured, otherwise use same bucket
                if settings.gcp_files_bucket:
                    self.files_bucket = self.client.bucket(settings.gcp_files_bucket)
                else:
                    self.files_bucket = self.images_bucket
            except Exception as e:
                print(f"Warning: Could not initialize GCP Storage client: {e}")
                print("Falling back to local file storage")
    
    def _setup_credentials(self) -> Optional[Path]:
        """
        Set up GCP credentials from environment variable or file path.
        
        For serverless deployments (Vercel, AWS Lambda), credentials should be
        provided as GCP_CREDENTIALS_JSON environment variable (JSON string).
        For local development, use GOOGLE_APPLICATION_CREDENTIALS pointing to a file path.
        
        Returns:
            Path to credentials file, or None if credentials couldn't be set up
        """
        # Method 1: Check for JSON content in environment variable (for serverless)
        gcp_creds_json = os.environ.get("GCP_CREDENTIALS_JSON", "")
        if gcp_creds_json:
            try:
                # Validate it's valid JSON
                json.loads(gcp_creds_json)
                
                # Write to /tmp (writable in serverless environments)
                tmp_creds_path = Path("/tmp/gcp-credentials.json")
                tmp_creds_path.write_text(gcp_creds_json)
                
                # Set permissions (readable by owner only for security)
                os.chmod(tmp_creds_path, 0o600)
                
                return tmp_creds_path
            except json.JSONDecodeError:
                print(f"Warning: GCP_CREDENTIALS_JSON is not valid JSON")
            except Exception as e:
                print(f"Warning: Could not write GCP credentials to /tmp: {e}")
        
        # Method 2: Check for file path (for local development)
        creds_value = settings.google_application_credentials
        
        if not creds_value:
            # Check if it's already in os.environ (might be set externally)
            creds_value = os.environ.get("GOOGLE_APPLICATION_CREDENTIALS", "")
        
        if creds_value:
            # Convert to absolute path if relative
            creds_path = Path(creds_value)
            if not creds_path.is_absolute():
                # Try relative to project root
                project_root = Path(__file__).parent.parent.parent
                creds_path = project_root / creds_value
            
            # Verify the file exists
            if creds_path.exists():
                return creds_path.resolve()
            else:
                print(f"Warning: GCP credentials file not found at: {creds_path}")
        
        return None
    
    def _is_gcp_enabled(self) -> bool:
        """Check if GCP storage is properly configured."""
        return self.client is not None and self.images_bucket is not None
    
    async def upload_image(
        self, 
        file: UploadFile, 
        folder: str = "images"
    ) -> str:
        """
        Upload an image file to GCP Storage or local directory.
        
        Args:
            file: The uploaded file
            folder: The folder/prefix to store the file under (e.g., "images", "bands", "venues")
        
        Returns:
            The public URL or local path to the uploaded file
        """
        if not file or not file.filename:
            raise ValueError("No file provided")
        
        # Generate unique filename
        file_extension = Path(file.filename).suffix
        unique_filename = f"{uuid.uuid4()}{file_extension}"
        
        # Read file content
        content = await file.read()
        
        if self._is_gcp_enabled():
            # Upload to GCP Storage
            blob_name = f"{folder}/{unique_filename}"
            blob = self.images_bucket.blob(blob_name)
            
            # Set content type
            content_type = file.content_type or "application/octet-stream"
            
            try:
                blob.upload_from_string(content, content_type=content_type)
                
                # Note: With uniform bucket-level access, objects are publicly accessible
                # via bucket IAM policy (allUsers: Storage Object Viewer), not per-object ACLs
                # Construct public URL manually
                public_url = f"https://storage.googleapis.com/{self.images_bucket.name}/{blob_name}"
                
                return public_url
            except GoogleCloudError as e:
                raise HTTPException(
                    status_code=500,
                    detail=f"Failed to upload image to GCP: {str(e)}"
                )
        else:
            # Fallback to local storage
            # Use /tmp in serverless environments (read-only filesystem except /tmp)
            # This also works in development environments
            base_dir = Path("/tmp")
            local_dir = base_dir / folder
            local_dir.mkdir(parents=True, exist_ok=True)
            
            file_path = local_dir / unique_filename
            with open(file_path, "wb") as buffer:
                buffer.write(content)
            
            # Return relative path for local storage
            return f"{folder}/{unique_filename}"
    
    async def upload_file(
        self, 
        file: UploadFile, 
        folder: str = "files"
    ) -> tuple[str, int]:
        """
        Upload a file (e.g., rehearsal attachment) to GCP Storage or local directory.
        
        Args:
            file: The uploaded file
            folder: The folder/prefix to store the file under
        
        Returns:
            Tuple of (file URL/path, file size in bytes)
        """
        if not file or not file.filename:
            raise ValueError("No file provided")
        
        # Generate unique filename
        file_extension = Path(file.filename).suffix
        unique_filename = f"{uuid.uuid4()}{file_extension}"
        
        # Read file content
        content = await file.read()
        file_size = len(content)
        
        if self._is_gcp_enabled():
            # Upload to GCP Storage
            blob_name = f"{folder}/{unique_filename}"
            blob = self.files_bucket.blob(blob_name)
            
            # Set content type
            content_type = file.content_type or "application/octet-stream"
            
            try:
                blob.upload_from_string(content, content_type=content_type)
                
                # Note: With uniform bucket-level access, objects are publicly accessible
                # via bucket IAM policy (allUsers: Storage Object Viewer), not per-object ACLs
                # Construct public URL manually
                public_url = f"https://storage.googleapis.com/{self.files_bucket.name}/{blob_name}"
                
                return public_url, file_size
            except GoogleCloudError as e:
                raise HTTPException(
                    status_code=500,
                    detail=f"Failed to upload file to GCP: {str(e)}"
                )
        else:
            # Fallback to local storage
            # Use /tmp in serverless environments (read-only filesystem except /tmp)
            # This also works in development environments
            base_dir = Path("/tmp")
            local_dir = base_dir / folder
            local_dir.mkdir(parents=True, exist_ok=True)
            
            file_path = local_dir / unique_filename
            with open(file_path, "wb") as buffer:
                buffer.write(content)
            
            # Return relative path and size for local storage
            return f"{folder}/{unique_filename}", file_size
    
    def delete_image(self, image_path: str) -> bool:
        """
        Delete an image from GCP Storage or local directory.
        
        Args:
            image_path: The full URL or relative path to the image
        
        Returns:
            True if deletion was successful, False otherwise
        """
        if not image_path:
            return False
        
        if self._is_gcp_enabled() and image_path.startswith("http"):
            # Extract blob name from URL
            # URL format: https://storage.googleapis.com/bucket-name/path/to/file
            try:
                # Parse the blob name from the URL
                parts = image_path.split(f"{self.images_bucket.name}/")
                if len(parts) > 1:
                    blob_name = parts[1]
                    blob = self.images_bucket.blob(blob_name)
                    blob.delete()
                    return True
            except GoogleCloudError as e:
                print(f"Warning: Could not delete image from GCP: {e}")
                return False
        else:
            # Delete from local storage
            # Check in /tmp directory (used for serverless environments)
            try:
                # Try /tmp first (for serverless environments)
                tmp_path = Path("/tmp") / image_path
                if tmp_path.exists():
                    tmp_path.unlink()
                    return True
                
                # Fallback to current directory (for local development)
                file_path = Path(image_path)
                if file_path.exists():
                    file_path.unlink()
                    return True
            except Exception as e:
                print(f"Warning: Could not delete local file: {e}")
                return False
        
        return False
    
    def delete_file(self, file_path: str) -> bool:
        """
        Delete a file from GCP Storage or local directory.
        
        Args:
            file_path: The full URL or relative path to the file
        
        Returns:
            True if deletion was successful, False otherwise
        """
        if not file_path:
            return False
        
        if self._is_gcp_enabled() and file_path.startswith("http"):
            # Extract blob name from URL
            try:
                # Parse the blob name from the URL
                parts = file_path.split(f"{self.files_bucket.name}/")
                if len(parts) > 1:
                    blob_name = parts[1]
                    blob = self.files_bucket.blob(blob_name)
                    blob.delete()
                    return True
            except GoogleCloudError as e:
                print(f"Warning: Could not delete file from GCP: {e}")
                return False
        else:
            # Delete from local storage
            # Check in /tmp directory (used for serverless environments)
            try:
                # Try /tmp first (for serverless environments)
                tmp_path = Path("/tmp") / file_path
                if tmp_path.exists():
                    tmp_path.unlink()
                    return True
                
                # Fallback to current directory (for local development)
                file_path_obj = Path(file_path)
                if file_path_obj.exists():
                    file_path_obj.unlink()
                    return True
            except Exception as e:
                print(f"Warning: Could not delete local file: {e}")
                return False
        
        return False


# Create a singleton instance
storage_service = StorageService()

