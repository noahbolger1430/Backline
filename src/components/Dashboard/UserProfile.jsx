import React, { useState, useEffect } from "react";
import { userService } from "../../services/userService";
import { bandService } from "../../services/bandService";
import MemberEquipment from "./MemberEquipment";
import "./Dashboard.css";

const UserProfile = ({ onUserUpdate }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [user, setUser] = useState(null);
  const [bands, setBands] = useState([]);
  const [formData, setFormData] = useState({
    email: "",
    full_name: "",
    password: "",
  });
  const [bandMemberData, setBandMemberData] = useState({}); // { bandId: { instrument, memberId } }
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchUserData = async () => {
      try {
        setLoading(true);
        const userData = await userService.getCurrentUser();
        setUser(userData);
        setFormData({
          email: userData.email || "",
          full_name: userData.full_name || "",
          password: "",
        });

        // Fetch user's bands
        const userBands = await bandService.getUserBands();
        setBands(userBands || []);

        // Initialize band member data
        const memberDataMap = {};
        if (userBands && Array.isArray(userBands)) {
          userBands.forEach((band) => {
            if (band.members && Array.isArray(band.members)) {
              // Find current user's membership in this band
              const currentUserEmail = userData.email;
              const member = band.members.find(
                (m) => m.user_email === currentUserEmail
              );
              if (member) {
                memberDataMap[band.id] = {
                  instrument: member.instrument || "",
                  memberId: member.id,
                };
              }
            }
          });
        }
        setBandMemberData(memberDataMap);
      } catch (err) {
        setError(err.message || "Failed to load user information");
        console.error("Error fetching user data:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchUserData();
  }, []);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleBandMemberInputChange = (bandId, value) => {
    setBandMemberData((prev) => ({
      ...prev,
      [bandId]: {
        ...prev[bandId],
        instrument: value,
      },
    }));
  };

  const handleEditClick = () => {
    setIsEditing(true);
    setError(null);
    // Reset password field when entering edit mode
    setFormData((prev) => ({
      ...prev,
      password: "",
    }));
  };

  const handleCancel = () => {
    setIsEditing(false);
    setFormData({
      email: user?.email || "",
      full_name: user?.full_name || "",
      password: "",
    });
    setError(null);
    
    // Reset band member data
    const memberDataMap = {};
    if (bands && Array.isArray(bands)) {
      const currentUserEmail = user?.email;
      bands.forEach((band) => {
        if (band.members && Array.isArray(band.members)) {
          const member = band.members.find(
            (m) => m.user_email === currentUserEmail
          );
          if (member) {
            memberDataMap[band.id] = {
              instrument: member.instrument || "",
              memberId: member.id,
            };
          }
        }
      });
    }
    setBandMemberData(memberDataMap);
  };

  const handleSubmit = async () => {
    try {
      setSaving(true);
      setError(null);

      // Prepare update data - only include fields that have changed
      const updateData = {};
      if (formData.email !== user.email) {
        updateData.email = formData.email;
      }
      if (formData.full_name !== user.full_name) {
        updateData.full_name = formData.full_name;
      }
      // Only include password if it's been entered
      if (formData.password && formData.password.trim()) {
        updateData.password = formData.password;
      }

      // Update user info if there are changes
      let updatedUser = user;
      if (Object.keys(updateData).length > 0) {
        updatedUser = await userService.updateUser(updateData);
        setUser(updatedUser);
        if (onUserUpdate) {
          onUserUpdate(updatedUser);
        }
        // Clear password field after successful update
        setFormData((prev) => ({
          ...prev,
          password: "",
        }));
      }
      const currentUserEmail = updatedUser.email;
      // Update band member info for each band
      const updatePromises = [];
      if (bands && Array.isArray(bands)) {
        bands.forEach((band) => {
          if (band.members && Array.isArray(band.members)) {
            const member = band.members.find(
              (m) => m.user_email === currentUserEmail
            );
            if (member) {
              const currentInstrument = member.instrument || "";
              const newInstrument = bandMemberData[band.id]?.instrument || "";
              // Only update if the instrument has changed
              if (currentInstrument !== newInstrument) {
                updatePromises.push(
                  bandService.updateMyBandMemberInfo(band.id, newInstrument || null)
                );
              }
            }
          }
        });
      }

      // Wait for all band member updates to complete
      if (updatePromises.length > 0) {
        await Promise.all(updatePromises);
        // Refresh bands data to get updated member info
        const updatedBands = await bandService.getUserBands();
        setBands(updatedBands || []);
        
        // Update band member data map with fresh data
        const updatedMemberDataMap = {};
        if (updatedBands && Array.isArray(updatedBands)) {
          updatedBands.forEach((band) => {
            if (band.members && Array.isArray(band.members)) {
              const member = band.members.find(
                (m) => m.user_email === currentUserEmail
              );
              if (member) {
                updatedMemberDataMap[band.id] = {
                  instrument: member.instrument || "",
                  memberId: member.id,
                };
              }
            }
          });
        }
        setBandMemberData(updatedMemberDataMap);
      }

      setIsEditing(false);
    } catch (err) {
      setError(err.message || "Failed to update user information");
      console.error("Error updating user:", err);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="user-profile-container">
        <div className="loading-message">Loading profile...</div>
      </div>
    );
  }

  if (error && !user) {
    return (
      <div className="user-profile-container">
        <div className="error-message">Error: {error}</div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="user-profile-container">
        <div className="error-message">User information not available</div>
      </div>
    );
  }

  return (
    <div className="user-profile-container">
      {error && <div className="user-profile-error">{error}</div>}

      <div className="user-profile-content">
        <div className="user-profile-field">
          <label htmlFor="user-email">Email</label>
          {isEditing ? (
            <input
              type="email"
              id="user-email"
              name="email"
              value={formData.email}
              onChange={handleInputChange}
              className="user-profile-input"
              disabled={saving}
            />
          ) : (
            <div className="user-profile-value">{user.email || "Not set"}</div>
          )}
        </div>

        <div className="user-profile-field">
          <label htmlFor="user-full-name">Full Name</label>
          {isEditing ? (
            <input
              type="text"
              id="user-full-name"
              name="full_name"
              value={formData.full_name}
              onChange={handleInputChange}
              className="user-profile-input"
              disabled={saving}
              placeholder="Enter your full name"
            />
          ) : (
            <div className="user-profile-value">{user.full_name || "Not set"}</div>
          )}
        </div>

        {isEditing && (
          <div className="user-profile-field">
            <label htmlFor="user-password">New Password (optional)</label>
            <input
              type="password"
              id="user-password"
              name="password"
              value={formData.password}
              onChange={handleInputChange}
              className="user-profile-input"
              disabled={saving}
              placeholder="Leave blank to keep current password"
            />
            <div className="user-profile-hint">
              Password must contain uppercase, lowercase, number, and special character
            </div>
          </div>
        )}

        {/* Band Memberships Section */}
        {bands && bands.length > 0 && (
          <div className="user-profile-band-memberships">
            <h3 className="user-profile-section-title">Band Memberships</h3>
            {bands.map((band) => {
              const currentUserEmail = user?.email;
              const member = band.members?.find(
                (m) => m.user_email === currentUserEmail
              );
              const memberInfo = bandMemberData[band.id] || {
                instrument: member?.instrument || "",
                memberId: member?.id,
              };

              return (
                <div key={band.id} className="user-profile-band-membership">
                  <div className="user-profile-band-name">{band.name}</div>
                  <div className="user-profile-field">
                    <label htmlFor={`band-${band.id}-instrument`}>Instrument</label>
                    {isEditing ? (
                      <input
                        type="text"
                        id={`band-${band.id}-instrument`}
                        value={memberInfo.instrument || ""}
                        onChange={(e) =>
                          handleBandMemberInputChange(band.id, e.target.value)
                        }
                        className="user-profile-input"
                        disabled={saving}
                        placeholder="e.g., Guitar, Drums, Vocals"
                      />
                    ) : (
                      <div className="user-profile-value">
                        {memberInfo.instrument || "Not set"}
                      </div>
                    )}
                  </div>
                  
                  {/* Equipment Section for Gear Share */}
                  <MemberEquipment
                    bandId={band.id}
                    bandName={band.name}
                    isEditing={isEditing}
                  />
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="user-profile-actions">
        {isEditing ? (
          <>
            <button
              className="user-profile-button cancel-button"
              onClick={handleCancel}
              disabled={saving}
            >
              Cancel
            </button>
            <button
              className="user-profile-button submit-button"
              onClick={handleSubmit}
              disabled={saving}
            >
              {saving ? "Submitting..." : "Submit"}
            </button>
          </>
        ) : (
          <button
            className="user-profile-button edit-button"
            onClick={handleEditClick}
          >
            Edit
          </button>
        )}
      </div>
    </div>
  );
};

export default UserProfile;

