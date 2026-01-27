import React, { useState, useEffect } from "react";
import { physicalTicketService } from "../../services/physicalTicketService";
import { bandService } from "../../services/bandService";
import "./BandTicketSalesModal.css";

const BandTicketSalesModal = ({ event, bandId, onClose }) => {
  const [allocation, setAllocation] = useState(null);
  const [bandMembers, setBandMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [actionLoading, setActionLoading] = useState(false);

  // Form states
  const [showSaleForm, setShowSaleForm] = useState(false);
  const [editingSale, setEditingSale] = useState(null);
  const [saleFormData, setSaleFormData] = useState({
    ticket_number: "",
    purchaser_name: "",
    purchaser_email: "",
    purchaser_phone: "",
    delivery_address: "",
    quantity: 1,
    is_paid: false,
    is_delivered: false,
    delivery_assigned_to_member_id: "",
    notes: "",
  });

  useEffect(() => {
    if (event?.id && bandId) {
      fetchAllocation();
      fetchBandMembers();
    }
  }, [event?.id, bandId]);

  const fetchAllocation = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await physicalTicketService.getBandTicketAllocation(bandId, event.id);
      setAllocation(data);
    } catch (err) {
      if (err.message.includes("404")) {
        setAllocation(null);
      } else {
        setError(err.message || "Failed to load ticket allocation");
      }
    } finally {
      setLoading(false);
    }
  };

  const fetchBandMembers = async () => {
    try {
      const bandData = await bandService.getBandDetails(bandId);
      setBandMembers(bandData.members || []);
    } catch (err) {
      console.error("Error fetching band members:", err);
    }
  };

  const handleSaleSubmit = async (e) => {
    e.preventDefault();
    try {
      setActionLoading(true);
      setError(null);

      const saleData = {
        ticket_number: saleFormData.ticket_number,
        purchaser_name: saleFormData.purchaser_name,
        purchaser_email: saleFormData.purchaser_email || null,
        purchaser_phone: saleFormData.purchaser_phone || null,
        delivery_address: saleFormData.delivery_address,
        quantity: saleFormData.quantity,
        is_paid: saleFormData.is_paid,
        is_delivered: saleFormData.is_delivered,
        delivery_assigned_to_member_id: saleFormData.delivery_assigned_to_member_id
          ? parseInt(saleFormData.delivery_assigned_to_member_id)
          : null,
        notes: saleFormData.notes || null,
      };

      if (editingSale) {
        await physicalTicketService.updateSale(editingSale.id, saleData);
      } else {
        await physicalTicketService.recordSale(allocation.id, saleData);
      }

      await fetchAllocation();
      resetForm();
    } catch (err) {
      setError(err.message || "Failed to save ticket sale");
    } finally {
      setActionLoading(false);
    }
  };

  const handleEditSale = (sale) => {
    setEditingSale(sale);
    setSaleFormData({
      ticket_number: sale.ticket_number,
      purchaser_name: sale.purchaser_name,
      purchaser_email: sale.purchaser_email || "",
      purchaser_phone: sale.purchaser_phone || "",
      delivery_address: sale.delivery_address,
      quantity: sale.quantity,
      is_paid: sale.is_paid,
      is_delivered: sale.is_delivered,
      delivery_assigned_to_member_id: sale.delivery_assigned_to_member_id || "",
      notes: sale.notes || "",
    });
    setShowSaleForm(true);
  };

  const handleDeleteSale = async (saleId) => {
    if (!window.confirm("Are you sure you want to delete this ticket sale?")) {
      return;
    }

    try {
      setActionLoading(true);
      setError(null);
      await physicalTicketService.deleteSale(saleId);
      await fetchAllocation();
    } catch (err) {
      setError(err.message || "Failed to delete ticket sale");
    } finally {
      setActionLoading(false);
    }
  };

  const resetForm = () => {
    setSaleFormData({
      ticket_number: "",
      purchaser_name: "",
      purchaser_email: "",
      purchaser_phone: "",
      delivery_address: "",
      quantity: 1,
      is_paid: false,
      is_delivered: false,
      delivery_assigned_to_member_id: "",
      notes: "",
    });
    setEditingSale(null);
    setShowSaleForm(false);
  };

  const formatCurrency = (cents) => {
    if (cents == null) return "$0.00";
    return `$${(cents / 100).toFixed(2)}`;
  };

  const getMemberName = (memberId) => {
    if (!memberId) return "Door Pick Up";
    const member = bandMembers.find((m) => m.id === memberId);
    if (!member) return `Member #${memberId}`;
    // Member structure can vary - try user_name first, then user.name, then user.full_name, then name
    return member.user_name || member.user?.name || member.user?.full_name || member.name || `Member #${memberId}`;
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal-content band-ticket-sales-modal"
        onClick={(e) => e.stopPropagation()}
      >
        <button className="modal-close" onClick={onClose} aria-label="Close">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
        </button>

        <div className="band-ticket-sales-header">
          <h2>Ticket Sales</h2>
          <p className="band-ticket-sales-event-name">{event?.name}</p>
        </div>

        {error && <div className="band-ticket-sales-error">{error}</div>}

        {loading ? (
          <div className="band-ticket-sales-loading">Loading...</div>
        ) : !allocation ? (
          <div className="band-ticket-sales-empty">
            <p>No tickets have been allocated to your band for this event.</p>
          </div>
        ) : (
          <>
            {/* Allocation Summary */}
            <div className="band-ticket-summary">
              <div className="summary-info">
                <div className="summary-item">
                  <span className="summary-label">Ticket Range:</span>
                  <span className="summary-value">{allocation.ticket_range}</span>
                </div>
                <div className="summary-item">
                  <span className="summary-label">Allocated:</span>
                  <span className="summary-value">{allocation.allocated_quantity}</span>
                </div>
                <div className="summary-item">
                  <span className="summary-label">Sold:</span>
                  <span className="summary-value">{allocation.sold_count}</span>
                </div>
                <div className="summary-item">
                  <span className="summary-label">Remaining:</span>
                  <span className="summary-value">{allocation.unsold_count}</span>
                </div>
              </div>
              {event?.ticket_price && (
                <div className="summary-proceeds">
                  <span className="summary-label">Expected Proceeds:</span>
                  <span className="summary-value">
                    {formatCurrency(event.ticket_price * allocation.sold_count)}
                  </span>
                </div>
              )}
            </div>

            {/* Add Sale Button */}
            {!showSaleForm && allocation.unsold_count > 0 && (
              <div className="band-ticket-actions">
                <button
                  className="btn-primary"
                  onClick={() => setShowSaleForm(true)}
                >
                  + Record Ticket Sale
                </button>
              </div>
            )}

            {/* Sale Form */}
            {showSaleForm && (
              <form className="band-ticket-sale-form" onSubmit={handleSaleSubmit}>
                <h3>{editingSale ? "Edit Sale" : "Record New Sale"}</h3>
                
                <div className="form-group">
                  <label htmlFor="ticket_number">Ticket Number *</label>
                  {editingSale ? (
                    <input
                      type="text"
                      id="ticket_number"
                      value={saleFormData.ticket_number}
                      disabled
                      className="disabled-input"
                    />
                  ) : (
                    <select
                      id="ticket_number"
                      value={saleFormData.ticket_number}
                      onChange={(e) =>
                        setSaleFormData({ ...saleFormData, ticket_number: e.target.value })
                      }
                      required
                    >
                      <option value="">Select Ticket Number...</option>
                      {allocation.available_ticket_numbers?.map((num) => (
                        <option key={num} value={num}>
                          {num}
                        </option>
                      ))}
                    </select>
                  )}
                </div>

                <div className="form-group">
                  <label htmlFor="purchaser_name">Purchaser Name *</label>
                  <input
                    type="text"
                    id="purchaser_name"
                    value={saleFormData.purchaser_name}
                    onChange={(e) =>
                      setSaleFormData({ ...saleFormData, purchaser_name: e.target.value })
                    }
                    required
                  />
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label htmlFor="purchaser_email">Email</label>
                    <input
                      type="email"
                      id="purchaser_email"
                      value={saleFormData.purchaser_email}
                      onChange={(e) =>
                        setSaleFormData({ ...saleFormData, purchaser_email: e.target.value })
                      }
                    />
                  </div>

                  <div className="form-group">
                    <label htmlFor="purchaser_phone">Phone</label>
                    <input
                      type="tel"
                      id="purchaser_phone"
                      value={saleFormData.purchaser_phone}
                      onChange={(e) =>
                        setSaleFormData({ ...saleFormData, purchaser_phone: e.target.value })
                      }
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label htmlFor="delivery_address">Delivery Address *</label>
                  <textarea
                    id="delivery_address"
                    value={saleFormData.delivery_address}
                    onChange={(e) =>
                      setSaleFormData({ ...saleFormData, delivery_address: e.target.value })
                    }
                    rows="3"
                    required
                    placeholder="Enter full address or 'Door Pick Up'"
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="quantity">Quantity *</label>
                  <input
                    type="number"
                    id="quantity"
                    value={saleFormData.quantity}
                    onChange={(e) =>
                      setSaleFormData({
                        ...saleFormData,
                        quantity: parseInt(e.target.value) || 1,
                      })
                    }
                    min="1"
                    max={allocation.unsold_count}
                    required
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="delivery_assigned_to_member_id">
                    Delivery Assigned To
                  </label>
                  <select
                    id="delivery_assigned_to_member_id"
                    value={saleFormData.delivery_assigned_to_member_id}
                    onChange={(e) =>
                      setSaleFormData({
                        ...saleFormData,
                        delivery_assigned_to_member_id: e.target.value,
                      })
                    }
                  >
                    <option value="">Door Pick Up</option>
                    {bandMembers.map((member) => {
                      const memberName = member.user_name || member.user?.name || member.user?.full_name || member.name || `Member #${member.id}`;
                      return (
                        <option key={member.id} value={member.id}>
                          {memberName}
                        </option>
                      );
                    })}
                  </select>
                </div>

                <div className="form-checkboxes">
                  <label className="checkbox-label">
                    <input
                      type="checkbox"
                      checked={saleFormData.is_paid}
                      onChange={(e) =>
                        setSaleFormData({ ...saleFormData, is_paid: e.target.checked })
                      }
                    />
                    <span>Payment Received</span>
                  </label>

                  <label className="checkbox-label">
                    <input
                      type="checkbox"
                      checked={saleFormData.is_delivered}
                      onChange={(e) =>
                        setSaleFormData({ ...saleFormData, is_delivered: e.target.checked })
                      }
                    />
                    <span>Delivered</span>
                  </label>
                </div>

                <div className="form-group">
                  <label htmlFor="notes">Notes</label>
                  <textarea
                    id="notes"
                    value={saleFormData.notes}
                    onChange={(e) =>
                      setSaleFormData({ ...saleFormData, notes: e.target.value })
                    }
                    rows="2"
                    placeholder="Additional notes..."
                  />
                </div>

                <div className="form-actions">
                  <button type="submit" className="btn-primary" disabled={actionLoading}>
                    {actionLoading ? "Saving..." : editingSale ? "Update Sale" : "Record Sale"}
                  </button>
                  <button
                    type="button"
                    className="btn-cancel"
                    onClick={resetForm}
                    disabled={actionLoading}
                  >
                    Cancel
                  </button>
                </div>
              </form>
            )}

            {/* Sales List */}
            {allocation.sales && allocation.sales.length > 0 ? (
              <div className="band-ticket-sales-list">
                <h3>Sales ({allocation.sales.length})</h3>
                {allocation.sales.map((sale) => (
                  <div key={sale.id} className="band-ticket-sale-item">
                    <div className="sale-header">
                      <div className="sale-ticket-number">{sale.ticket_number}</div>
                      <div className="sale-quantity">Qty: {sale.quantity}</div>
                      <div className="sale-actions">
                        <button
                          className="btn-icon"
                          onClick={() => handleEditSale(sale)}
                          title="Edit sale"
                        >
                          ✏️
                        </button>
                        <button
                          className="btn-icon danger"
                          onClick={() => handleDeleteSale(sale.id)}
                          title="Delete sale"
                        >
                          🗑️
                        </button>
                      </div>
                    </div>
                    <div className="sale-details">
                      <div className="sale-detail-row">
                        <span className="sale-label">Purchaser:</span>
                        <span className="sale-value">{sale.purchaser_name}</span>
                      </div>
                      {sale.purchaser_email && (
                        <div className="sale-detail-row">
                          <span className="sale-label">Email:</span>
                          <span className="sale-value">{sale.purchaser_email}</span>
                        </div>
                      )}
                      {sale.purchaser_phone && (
                        <div className="sale-detail-row">
                          <span className="sale-label">Phone:</span>
                          <span className="sale-value">{sale.purchaser_phone}</span>
                        </div>
                      )}
                      <div className="sale-detail-row">
                        <span className="sale-label">Address:</span>
                        <span className="sale-value">{sale.delivery_address}</span>
                      </div>
                      <div className="sale-detail-row">
                        <span className="sale-label">Delivery:</span>
                        <span className="sale-value">
                          {getMemberName(sale.delivery_assigned_to_member_id)}
                        </span>
                      </div>
                      <div className="sale-status-row">
                        <span
                          className={`sale-status ${sale.is_paid ? "paid" : "unpaid"}`}
                        >
                          {sale.is_paid ? "✓ Paid" : "○ Unpaid"}
                        </span>
                        <span
                          className={`sale-status ${sale.is_delivered ? "delivered" : "not-delivered"}`}
                        >
                          {sale.is_delivered ? "✓ Delivered" : "○ Not Delivered"}
                        </span>
                      </div>
                      {sale.notes && (
                        <div className="sale-notes">
                          <span className="sale-label">Notes:</span>
                          <span className="sale-value">{sale.notes}</span>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="band-ticket-sales-empty-list">
                <p>No ticket sales recorded yet.</p>
                {allocation.unsold_count > 0 && (
                  <button
                    className="btn-link"
                    onClick={() => setShowSaleForm(true)}
                  >
                    Record your first sale
                  </button>
                )}
              </div>
            )}
          </>
        )}

        <div className="modal-actions">
          <button
            type="button"
            className="modal-button cancel-button"
            onClick={onClose}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default BandTicketSalesModal;

