import React, { useState, useEffect } from "react";
import { physicalTicketService } from "../../services/physicalTicketService";
import "./PhysicalTicketsModal.css";

const PhysicalTicketsModal = ({ event, onClose }) => {
  const [ticketPool, setTicketPool] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [actionLoading, setActionLoading] = useState(false);

  // Create pool form
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [poolQuantity, setPoolQuantity] = useState(100);
  const [poolPrefix, setPoolPrefix] = useState("");

  // Allocate form
  const [showAllocateForm, setShowAllocateForm] = useState(false);
  const [selectedBandEventId, setSelectedBandEventId] = useState("");
  const [allocateQuantity, setAllocateQuantity] = useState(10);

  // Edit allocation
  const [editingAllocation, setEditingAllocation] = useState(null);
  const [editQuantity, setEditQuantity] = useState(0);

  useEffect(() => {
    if (event?.id) {
      fetchTicketPool();
      generateDefaultPrefix();
    }
  }, [event?.id]);

  const generateDefaultPrefix = () => {
    if (!event) return;
    const year = new Date(event.event_date).getFullYear();
    const safeName = event.name
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, "")
      .substring(0, 6);
    setPoolPrefix(`${safeName}${year}-`);
  };

  const fetchTicketPool = async () => {
    try {
      setLoading(true);
      setError(null);
      const pool = await physicalTicketService.getTicketPool(event.id);
      setTicketPool(pool);
      if (!pool) {
        setShowCreateForm(true);
      }
    } catch (err) {
      if (err.message.includes("404")) {
        setTicketPool(null);
        setShowCreateForm(true);
      } else {
        setError(err.message || "Failed to load ticket pool");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleCreatePool = async (e) => {
    e.preventDefault();
    try {
      setActionLoading(true);
      setError(null);
      await physicalTicketService.createTicketPool(event.id, {
        total_quantity: poolQuantity,
        ticket_prefix: poolPrefix,
      });
      await fetchTicketPool();
      setShowCreateForm(false);
    } catch (err) {
      setError(err.message || "Failed to create ticket pool");
    } finally {
      setActionLoading(false);
    }
  };

  const handleAllocateTickets = async (e) => {
    e.preventDefault();
    if (!selectedBandEventId) {
      setError("Please select a band");
      return;
    }
    try {
      setActionLoading(true);
      setError(null);
      await physicalTicketService.allocateTickets(event.id, {
        band_event_id: parseInt(selectedBandEventId),
        allocated_quantity: allocateQuantity,
      });
      await fetchTicketPool();
      setShowAllocateForm(false);
      setSelectedBandEventId("");
      setAllocateQuantity(10);
    } catch (err) {
      setError(err.message || "Failed to allocate tickets");
    } finally {
      setActionLoading(false);
    }
  };

  const handleUpdateAllocation = async (allocationId) => {
    try {
      setActionLoading(true);
      setError(null);
      await physicalTicketService.updateAllocation(allocationId, {
        allocated_quantity: editQuantity,
      });
      await fetchTicketPool();
      setEditingAllocation(null);
    } catch (err) {
      setError(err.message || "Failed to update allocation");
    } finally {
      setActionLoading(false);
    }
  };

  const handleDeleteAllocation = async (allocationId) => {
    if (!window.confirm("Are you sure you want to remove this allocation?")) {
      return;
    }
    try {
      setActionLoading(true);
      setError(null);
      await physicalTicketService.deleteAllocation(allocationId);
      await fetchTicketPool();
    } catch (err) {
      setError(err.message || "Failed to delete allocation");
    } finally {
      setActionLoading(false);
    }
  };

  const handleDownloadPDF = async () => {
    try {
      setActionLoading(true);
      setError(null);
      await physicalTicketService.downloadTicketsPDF(event.id, event.name);
    } catch (err) {
      setError(err.message || "Failed to download PDF");
    } finally {
      setActionLoading(false);
    }
  };

  const handleDeletePool = async () => {
    if (
      !window.confirm(
        "Are you sure you want to delete the entire ticket pool? This will remove all allocations and sales data."
      )
    ) {
      return;
    }
    try {
      setActionLoading(true);
      setError(null);
      await physicalTicketService.deleteTicketPool(event.id);
      setTicketPool(null);
      setShowCreateForm(true);
    } catch (err) {
      setError(err.message || "Failed to delete ticket pool");
    } finally {
      setActionLoading(false);
    }
  };

  const getUnallocatedBands = () => {
    if (!event?.bands || !ticketPool) return [];
    const allocatedBandEventIds = new Set(
      ticketPool.allocations.map((a) => a.band_event_id)
    );
    return event.bands.filter((be) => !allocatedBandEventIds.has(be.id));
  };

  const formatCurrency = (cents) => {
    if (cents == null) return "$0.00";
    return `$${(cents / 100).toFixed(2)}`;
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal-content physical-tickets-modal"
        onClick={(e) => e.stopPropagation()}
      >
        <button className="modal-close" onClick={onClose}>
          ×
        </button>

        <div className="physical-tickets-header">
          <h2>Physical Tickets</h2>
          <p className="physical-tickets-event-name">{event?.name}</p>
        </div>

        {error && <div className="physical-tickets-error">{error}</div>}

        {loading ? (
          <div className="physical-tickets-loading">Loading...</div>
        ) : !ticketPool ? (
          /* Create Pool Form */
          <div className="physical-tickets-create">
            <h3>Create Ticket Pool</h3>
            <p className="physical-tickets-info">
              Create a pool of physical tickets that can be allocated to bands
              performing at this event.
            </p>
            <form onSubmit={handleCreatePool}>
              <div className="form-group">
                <label htmlFor="poolQuantity">Total Tickets</label>
                <input
                  type="number"
                  id="poolQuantity"
                  value={poolQuantity}
                  onChange={(e) => setPoolQuantity(parseInt(e.target.value) || 0)}
                  min="1"
                  max="10000"
                  required
                />
              </div>
              <div className="form-group">
                <label htmlFor="poolPrefix">Ticket Prefix</label>
                <input
                  type="text"
                  id="poolPrefix"
                  value={poolPrefix}
                  onChange={(e) => setPoolPrefix(e.target.value)}
                  placeholder="e.g., EVT2026-"
                  maxLength="50"
                  required
                />
                <small className="form-help">
                  Tickets will be numbered like: {poolPrefix}0001, {poolPrefix}
                  0002, etc.
                </small>
              </div>
              <div className="form-actions">
                <button
                  type="submit"
                  className="btn-primary"
                  disabled={actionLoading}
                >
                  {actionLoading ? "Creating..." : "Create Ticket Pool"}
                </button>
              </div>
            </form>
          </div>
        ) : (
          /* Pool exists - show details */
          <>
            {/* Pool Summary */}
            <div className="physical-tickets-summary">
              <div className="summary-stats">
                <div className="stat-item">
                  <span className="stat-value">{ticketPool.total_quantity}</span>
                  <span className="stat-label">Total Tickets</span>
                </div>
                <div className="stat-item">
                  <span className="stat-value">{ticketPool.allocated_count}</span>
                  <span className="stat-label">Allocated</span>
                </div>
                <div className="stat-item">
                  <span className="stat-value">{ticketPool.unallocated_count}</span>
                  <span className="stat-label">Unallocated</span>
                </div>
                <div className="stat-item">
                  <span className="stat-value">{ticketPool.total_sold}</span>
                  <span className="stat-label">Sold</span>
                </div>
              </div>
              <div className="summary-range">
                <strong>Ticket Range:</strong>{" "}
                {ticketPool.ticket_prefix}
                {String(ticketPool.start_number).padStart(4, "0")} to{" "}
                {ticketPool.ticket_prefix}
                {String(ticketPool.end_number).padStart(4, "0")}
              </div>
            </div>

            {/* Pool Actions */}
            <div className="physical-tickets-actions">
              <button
                className="btn-secondary"
                onClick={handleDownloadPDF}
                disabled={actionLoading}
              >
                📄 Download Tickets PDF
              </button>
              <button
                className="btn-danger-outline"
                onClick={handleDeletePool}
                disabled={actionLoading}
              >
                🗑️ Delete Pool
              </button>
            </div>

            {/* Allocations Section */}
            <div className="physical-tickets-allocations">
              <div className="allocations-header">
                <h3>Band Allocations</h3>
                {ticketPool.allocations && ticketPool.allocations.length > 0 && getUnallocatedBands().length > 0 && !showAllocateForm && (
                  <button
                    className="btn-link"
                    onClick={() => setShowAllocateForm(true)}
                  >
                    + Allocate to Band
                  </button>
                )}
              </div>

              {/* Allocate Form */}
              {showAllocateForm && (
                <form
                  className="allocate-form"
                  onSubmit={handleAllocateTickets}
                >
                  <div className="form-row">
                    <select
                      value={selectedBandEventId}
                      onChange={(e) => setSelectedBandEventId(e.target.value)}
                      required
                    >
                      <option value="">Select Band...</option>
                      {getUnallocatedBands().map((be) => (
                        <option key={be.id} value={be.id}>
                          {be.band_name || be.band?.name || `Band #${be.band_id}`}
                        </option>
                      ))}
                    </select>
                    <input
                      type="number"
                      value={allocateQuantity}
                      onChange={(e) =>
                        setAllocateQuantity(parseInt(e.target.value) || 0)
                      }
                      min="1"
                      max={ticketPool.unallocated_count}
                      placeholder="Quantity"
                      required
                    />
                  </div>
                  <div className="form-actions-row">
                    <button
                      type="submit"
                      className="btn-primary"
                      disabled={actionLoading}
                    >
                      Allocate
                    </button>
                    <button
                      type="button"
                      className="btn-cancel"
                      onClick={() => setShowAllocateForm(false)}
                    >
                      Cancel
                    </button>
                  </div>
                  <small className="form-help">
                    {ticketPool.unallocated_count} tickets available to allocate
                  </small>
                </form>
              )}

              {/* Allocations List */}
              {ticketPool.allocations && ticketPool.allocations.length > 0 ? (
                <div className="allocations-list">
                  {ticketPool.allocations.map((alloc) => (
                    <div key={alloc.id} className="allocation-item">
                      <div className="allocation-band-name">
                        {alloc.band_name || `Band #${alloc.band_id}`}
                      </div>
                      <div className="allocation-details-row">
                        <div className="allocation-info">
                          <div className="allocation-range">
                            {alloc.ticket_range}
                          </div>
                        </div>
                        <div className="allocation-stats">
                          <div className="alloc-stat">
                            <span className="alloc-stat-value">
                              {alloc.allocated_quantity}
                            </span>
                            <span className="alloc-stat-label">Allocated</span>
                          </div>
                          <div className="alloc-stat">
                            <span className="alloc-stat-value">{alloc.sold_count}</span>
                            <span className="alloc-stat-label">Sold</span>
                          </div>
                          <div className="alloc-stat">
                            <span className="alloc-stat-value paid">
                              {alloc.paid_count}
                            </span>
                            <span className="alloc-stat-label">Paid</span>
                          </div>
                          <div className="alloc-stat">
                            <span className="alloc-stat-value unpaid">
                              {alloc.unpaid_count}
                            </span>
                            <span className="alloc-stat-label">Unpaid</span>
                          </div>
                        </div>
                        <div className="allocation-actions">
                          {editingAllocation === alloc.id ? (
                            <div className="edit-allocation-form">
                              <input
                                type="number"
                                value={editQuantity}
                                onChange={(e) =>
                                  setEditQuantity(parseInt(e.target.value) || 0)
                                }
                                min={alloc.sold_count || 1}
                              />
                              <button
                                className="btn-small-confirm"
                                onClick={() => handleUpdateAllocation(alloc.id)}
                                disabled={actionLoading}
                              >
                                ✓
                              </button>
                              <button
                                className="btn-small-cancel"
                                onClick={() => setEditingAllocation(null)}
                              >
                                ✕
                              </button>
                            </div>
                          ) : (
                            <>
                              <button
                                className="btn-icon"
                                onClick={() => {
                                  setEditingAllocation(alloc.id);
                                  setEditQuantity(alloc.allocated_quantity);
                                }}
                                title="Edit allocation"
                              >
                                ✏️
                              </button>
                              <button
                                className="btn-icon danger"
                                onClick={() => handleDeleteAllocation(alloc.id)}
                                disabled={alloc.sold_count > 0}
                                title={
                                  alloc.sold_count > 0
                                    ? "Cannot delete - tickets have been sold"
                                    : "Delete allocation"
                                }
                              >
                                🗑️
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="allocations-empty">
                  No tickets have been allocated to bands yet.
                  {ticketPool.unallocated_count > 0 && (
                    <button
                      className="btn-link"
                      onClick={() => setShowAllocateForm(true)}
                    >
                      Allocate tickets to bands
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* Proceeds Summary */}
            {ticketPool.total_sold > 0 && event?.ticket_price && (
              <div className="physical-tickets-proceeds">
                <h3>Proceeds Summary</h3>
                <div className="proceeds-stats">
                  <div className="proceeds-item">
                    <span className="proceeds-label">Total Expected:</span>
                    <span className="proceeds-value">
                      {formatCurrency(event.ticket_price * ticketPool.total_sold)}
                    </span>
                  </div>
                </div>
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

export default PhysicalTicketsModal;

