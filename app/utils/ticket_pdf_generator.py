"""
PDF Generator for Physical Tickets.

This module generates printable PDF tickets with:
- Event details (name, venue, date, time)
- Unique ticket number
- QR code for validation
- Formatted for easy cutting (2x4 layout per page)
"""

import io
from datetime import date, time
from typing import List, Optional, Tuple

from reportlab.lib import colors
from reportlab.lib.pagesizes import LETTER
from reportlab.lib.units import inch
from reportlab.pdfgen import canvas
from reportlab.platypus import Table, TableStyle

try:
    import qrcode
    from PIL import Image
    QR_AVAILABLE = True
except ImportError:
    QR_AVAILABLE = False


# Ticket dimensions (2 columns x 4 rows per page)
TICKET_WIDTH = 3.75 * inch  # 3.75 inches
TICKET_HEIGHT = 2.25 * inch  # 2.25 inches
MARGIN = 0.25 * inch
TICKETS_PER_ROW = 2
TICKETS_PER_COL = 4
TICKETS_PER_PAGE = TICKETS_PER_ROW * TICKETS_PER_COL


class TicketData:
    """Data structure for a single ticket."""
    def __init__(
        self,
        ticket_number: str,
        event_name: str,
        venue_name: str,
        event_date: date,
        show_time: Optional[time],
        doors_time: Optional[time] = None,
        ticket_price_cents: Optional[int] = None,
        event_image_path: Optional[str] = None,
    ):
        self.ticket_number = ticket_number
        self.event_name = event_name
        self.venue_name = venue_name
        self.event_date = event_date
        self.show_time = show_time
        self.doors_time = doors_time
        self.ticket_price_cents = ticket_price_cents
        self.event_image_path = event_image_path
    
    @property
    def ticket_price_dollars(self) -> Optional[str]:
        """Return price formatted as dollars."""
        if self.ticket_price_cents is None:
            return None
        return f"${self.ticket_price_cents / 100:.2f}"


class TicketPDFGenerator:
    """
    Generates PDF documents containing printable tickets.
    """

    def __init__(self):
        self.page_width, self.page_height = LETTER
        # Calculate starting positions for 2x4 grid
        self.x_positions = [
            MARGIN,
            MARGIN + TICKET_WIDTH + MARGIN
        ]
        self.y_positions = [
            self.page_height - MARGIN - TICKET_HEIGHT,
            self.page_height - MARGIN - 2 * TICKET_HEIGHT - MARGIN,
            self.page_height - MARGIN - 3 * TICKET_HEIGHT - 2 * MARGIN,
            self.page_height - MARGIN - 4 * TICKET_HEIGHT - 3 * MARGIN,
        ]

    def generate_qr_code(self, data: str, size: int = 80) -> Optional[io.BytesIO]:
        """Generate a QR code image for the given data."""
        if not QR_AVAILABLE:
            return None
        
        qr = qrcode.QRCode(
            version=1,
            error_correction=qrcode.constants.ERROR_CORRECT_M,
            box_size=4,
            border=1,
        )
        qr.add_data(data)
        qr.make(fit=True)
        
        img = qr.make_image(fill_color="black", back_color="white")
        
        # Convert to bytes
        img_buffer = io.BytesIO()
        img.save(img_buffer, format='PNG')
        img_buffer.seek(0)
        return img_buffer

    def load_event_image(self, image_path: Optional[str]) -> Optional[io.BytesIO]:
        """Load event image from path or URL."""
        if not image_path:
            return None
        
        try:
            import os
            import requests
            from reportlab.lib.utils import ImageReader
            
            # Check if it's a URL (GCP storage or similar)
            if image_path.startswith('http://') or image_path.startswith('https://'):
                response = requests.get(image_path, timeout=5)
                if response.status_code == 200:
                    img_buffer = io.BytesIO(response.content)
                    return img_buffer
            else:
                # Local file path
                if os.path.exists(image_path):
                    with open(image_path, 'rb') as f:
                        img_buffer = io.BytesIO(f.read())
                        return img_buffer
        except Exception:
            # If image loading fails, continue without it
            pass
        
        return None

    def draw_ticket(
        self,
        c: canvas.Canvas,
        x: float,
        y: float,
        ticket: TicketData,
        event_image_buffer: Optional[io.BytesIO] = None,
    ) -> None:
        """
        Draw a single ticket at the specified position.
        
        Args:
            c: ReportLab canvas
            x: X position (left edge)
            y: Y position (bottom edge)
            ticket: Ticket data
            event_image_buffer: Pre-loaded event image buffer (optional)
        """
        # Draw ticket border with dashed lines for cutting
        c.saveState()
        c.setDash(3, 3)
        c.setStrokeColor(colors.gray)
        c.rect(x, y, TICKET_WIDTH, TICKET_HEIGHT, stroke=1, fill=0)
        c.restoreState()
        
        # Inner padding
        inner_x = x + 0.1 * inch
        inner_y = y + 0.1 * inch
        
        # Event image (left side, if available)
        image_width = 0
        if event_image_buffer:
            try:
                from reportlab.lib.utils import ImageReader
                event_image_buffer.seek(0)  # Reset buffer position
                img = ImageReader(event_image_buffer)
                img_size = 0.7 * inch
                img_x = inner_x
                img_y = y + TICKET_HEIGHT - 0.4 * inch - img_size
                c.drawImage(img, img_x, img_y, width=img_size, height=img_size, preserveAspectRatio=True, mask='auto')
                image_width = img_size + 0.1 * inch  # Add some padding
            except Exception:
                pass  # If image fails to draw, continue without it
        
        # Adjust text start position if image is present
        text_x = inner_x + image_width
        
        # Draw ticket number at top (prominent)
        c.setFont("Helvetica-Bold", 14)
        c.setFillColor(colors.black)
        c.drawString(inner_x, y + TICKET_HEIGHT - 0.3 * inch, ticket.ticket_number)
        
        # Draw "ADMIT ONE" label
        c.setFont("Helvetica", 8)
        c.setFillColor(colors.gray)
        c.drawRightString(x + TICKET_WIDTH - 0.15 * inch, y + TICKET_HEIGHT - 0.25 * inch, "ADMIT ONE")
        
        # Draw horizontal divider line
        c.setStrokeColor(colors.lightgrey)
        c.line(inner_x, y + TICKET_HEIGHT - 0.4 * inch, x + TICKET_WIDTH - 0.1 * inch, y + TICKET_HEIGHT - 0.4 * inch)
        
        # Event name
        c.setFont("Helvetica-Bold", 11)
        c.setFillColor(colors.black)
        
        # Truncate event name if too long (shorter if image is present)
        event_name = ticket.event_name
        max_len = 22 if image_width > 0 else 30
        if len(event_name) > max_len:
            event_name = event_name[:max_len-3] + "..."
        c.drawString(text_x, y + TICKET_HEIGHT - 0.6 * inch, event_name)
        
        # Venue name
        c.setFont("Helvetica", 9)
        c.setFillColor(colors.HexColor("#444444"))
        venue_name = ticket.venue_name
        max_venue_len = 27 if image_width > 0 else 35
        if len(venue_name) > max_venue_len:
            venue_name = venue_name[:max_venue_len-3] + "..."
        c.drawString(text_x, y + TICKET_HEIGHT - 0.8 * inch, venue_name)
        
        # Date and time
        c.setFont("Helvetica-Bold", 10)
        c.setFillColor(colors.black)
        date_str = ticket.event_date.strftime("%A, %B %d, %Y")
        c.drawString(text_x, y + TICKET_HEIGHT - 1.05 * inch, date_str)
        
        # Time info
        c.setFont("Helvetica", 9)
        time_parts = []
        if ticket.doors_time:
            time_parts.append(f"Doors: {ticket.doors_time.strftime('%I:%M %p')}")
        if ticket.show_time:
            time_parts.append(f"Show: {ticket.show_time.strftime('%I:%M %p')}")
        if time_parts:
            c.drawString(text_x, y + TICKET_HEIGHT - 1.25 * inch, "  |  ".join(time_parts))
        
        # Price (if available)
        if ticket.ticket_price_cents is not None:
            c.setFont("Helvetica-Bold", 10)
            c.setFillColor(colors.HexColor("#6F22D2"))  # Purple accent
            c.drawString(inner_x, y + 0.15 * inch, ticket.ticket_price_dollars)
        
        # QR Code (right side)
        qr_size = 0.9 * inch
        qr_x = x + TICKET_WIDTH - qr_size - 0.15 * inch
        qr_y = y + 0.2 * inch
        
        if QR_AVAILABLE:
            qr_data = f"TICKET:{ticket.ticket_number}"
            qr_buffer = self.generate_qr_code(qr_data)
            if qr_buffer:
                from reportlab.lib.utils import ImageReader
                qr_image = ImageReader(qr_buffer)
                c.drawImage(qr_image, qr_x, qr_y, width=qr_size, height=qr_size)
        else:
            # Draw placeholder box if QR not available
            c.setStrokeColor(colors.lightgrey)
            c.rect(qr_x, qr_y, qr_size, qr_size, stroke=1, fill=0)
            c.setFont("Helvetica", 6)
            c.setFillColor(colors.gray)
            c.drawCentredString(qr_x + qr_size/2, qr_y + qr_size/2, "QR CODE")

    def generate_pdf(self, tickets: List[TicketData]) -> io.BytesIO:
        """
        Generate a PDF document containing all tickets.
        
        Args:
            tickets: List of ticket data
            
        Returns:
            BytesIO buffer containing the PDF
        """
        buffer = io.BytesIO()
        c = canvas.Canvas(buffer, pagesize=LETTER)
        
        # Pre-load event image once (all tickets in a pool share the same image)
        event_image_buffer = None
        if tickets and tickets[0].event_image_path:
            event_image_buffer = self.load_event_image(tickets[0].event_image_path)
        
        ticket_index = 0
        while ticket_index < len(tickets):
            # Draw tickets on current page
            for row in range(TICKETS_PER_COL):
                for col in range(TICKETS_PER_ROW):
                    if ticket_index >= len(tickets):
                        break
                    
                    x = self.x_positions[col]
                    y = self.y_positions[row]
                    
                    self.draw_ticket(c, x, y, tickets[ticket_index], event_image_buffer)
                    ticket_index += 1
            
            # Add new page if more tickets
            if ticket_index < len(tickets):
                c.showPage()
        
        c.save()
        buffer.seek(0)
        return buffer

    def generate_tickets_from_pool(
        self,
        ticket_prefix: str,
        start_number: int,
        end_number: int,
        event_name: str,
        venue_name: str,
        event_date: date,
        show_time: Optional[time],
        doors_time: Optional[time] = None,
        ticket_price_cents: Optional[int] = None,
        event_image_path: Optional[str] = None,
    ) -> io.BytesIO:
        """
        Generate PDF for a range of tickets.
        
        Args:
            ticket_prefix: Prefix for ticket numbers
            start_number: Starting ticket number
            end_number: Ending ticket number
            event_name: Name of the event
            venue_name: Name of the venue
            event_date: Date of the event
            show_time: Show start time
            doors_time: Doors open time (optional)
            ticket_price_cents: Ticket price in cents (optional)
            event_image_path: Path to event image (optional)
            
        Returns:
            BytesIO buffer containing the PDF
        """
        tickets = []
        for num in range(start_number, end_number + 1):
            ticket_number = f"{ticket_prefix}{num:04d}"
            tickets.append(TicketData(
                ticket_number=ticket_number,
                event_name=event_name,
                venue_name=venue_name,
                event_date=event_date,
                show_time=show_time,
                doors_time=doors_time,
                ticket_price_cents=ticket_price_cents,
                event_image_path=event_image_path,
            ))
        
        return self.generate_pdf(tickets)


# Singleton instance
ticket_pdf_generator = TicketPDFGenerator()

