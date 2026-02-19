import React, { useState, useEffect } from "react";
import apiClient from "../api/client";
import { FiUser, FiMail, FiLock, FiPhone, FiMapPin, FiBriefcase, FiCheckCircle, FiAlertCircle, FiSave } from "react-icons/fi";

const ProfilePage = ({ user, onUserUpdate }) => {
    const [formData, setFormData] = useState({
        full_name: user?.full_name || "",
        email: user?.email || "",
        phone: user?.phone || "",
        department: user?.department || "",
        password: "",
        confirm_password: ""
    });

    // Re-sync form state whenever user prop changes (e.g. after save propagates)
    useEffect(() => {
        if (user) {
            setFormData(prev => ({
                ...prev,
                full_name: user.full_name || "",
                email: user.email || "",
                phone: user.phone || "",
                department: user.department || "",
            }));
        }
    }, [user]);

    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState(null);

    const handleChange = (e) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setMessage(null);

        if (formData.password && formData.password !== formData.confirm_password) {
            setMessage({ type: "error", text: "Passwords do not match" });
            return;
        }

        setLoading(true);
        try {
            const payload = {
                full_name: formData.full_name,
                email: formData.email,
                phone: formData.phone,
                department: formData.department
            };

            if (formData.password) {
                payload.password = formData.password;
            }

            const res = await apiClient.patch("/users/me", payload);
            const updatedUser = res.data.data.user;

            setMessage({ type: "success", text: "Profile updated successfully!" });
            setFormData(prev => ({ ...prev, password: "", confirm_password: "" }));

            if (onUserUpdate) {
                // Merge with existing user to preserve fields the API didn't return
                // (like role, location, user_id, etc.)
                onUserUpdate({ ...user, ...updatedUser });
            }
        } catch (err) {
            console.error("Profile update failed", err);
            setMessage({
                type: "error",
                text: err.response?.data?.message || "Failed to update profile"
            });
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="profile-page-container">
            <header className="page-header">
                <div className="header-info">
                    <h1>Profile Settings</h1>
                    <p>Manage your account credentials and personal information</p>
                </div>
            </header>

            <div className="profile-grid">
                {/* Left: Account Overview Card */}
                <div className="profile-card info-card glass hover-lift">
                    <div className="avatar-section">
                        <div className="avatar-placeholder">
                            {formData.full_name?.charAt(0) || user?.full_name?.charAt(0) || <FiUser />}
                        </div>
                        <h2>{formData.full_name || user?.full_name}</h2>
                        <span className="role-badge">{user?.role?.replace('_', ' ').toUpperCase()}</span>
                    </div>

                    <div className="user-meta-list">
                        <div className="meta-item">
                            <FiMapPin className="icon" />
                            <div className="text">
                                <label>Location</label>
                                <span>{user?.location || "Not assigned"}</span>
                            </div>
                        </div>
                        <div className="meta-item">
                            <FiBriefcase className="icon" />
                            <div className="text">
                                <label>Department</label>
                                <span>{formData.department || user?.department || "General"}</span>
                            </div>
                        </div>
                        <div className="meta-item">
                            <FiMail className="icon" />
                            <div className="text">
                                <label>Email Address</label>
                                <span>{formData.email || user?.email}</span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Right: Update Form Card */}
                <div className="profile-card form-card glass">
                    <form onSubmit={handleSubmit}>
                        <section className="form-section">
                            <h3><FiUser /> Personal Information</h3>
                            <div className="input-grid">
                                <div className="input-group">
                                    <label>Full Name</label>
                                    <div className="input-wrapper">
                                        <FiUser className="field-icon" />
                                        <input
                                            type="text"
                                            name="full_name"
                                            value={formData.full_name}
                                            onChange={handleChange}
                                            required
                                        />
                                    </div>
                                </div>
                                <div className="input-group">
                                    <label>Phone Number</label>
                                    <div className="input-wrapper">
                                        <FiPhone className="field-icon" />
                                        <input
                                            type="text"
                                            name="phone"
                                            value={formData.phone}
                                            onChange={handleChange}
                                            placeholder="+1 (555) 000-0000"
                                        />
                                    </div>
                                </div>
                            </div>
                        </section>

                        <section className="form-section">
                            <h3><FiMail /> Contact & Work</h3>
                            <div className="input-grid">
                                <div className="input-group">
                                    <label>Email Address</label>
                                    <div className="input-wrapper">
                                        <FiMail className="field-icon" />
                                        <input
                                            type="email"
                                            name="email"
                                            value={formData.email}
                                            onChange={handleChange}
                                            required
                                        />
                                    </div>
                                </div>
                                <div className="input-group">
                                    <label>Department</label>
                                    <div className="input-wrapper">
                                        <FiBriefcase className="field-icon" />
                                        <input
                                            type="text"
                                            name="department"
                                            value={formData.department}
                                            onChange={handleChange}
                                        />
                                    </div>
                                </div>
                            </div>
                        </section>

                        <section className="form-section">
                            <h3><FiLock /> Security Settings</h3>
                            <p className="section-hint">Leave blank to keep your current password</p>
                            <div className="input-grid">
                                <div className="input-group">
                                    <label>New Password</label>
                                    <div className="input-wrapper">
                                        <FiLock className="field-icon" />
                                        <input
                                            type="password"
                                            name="password"
                                            value={formData.password}
                                            onChange={handleChange}
                                            autoComplete="new-password"
                                        />
                                    </div>
                                </div>
                                <div className="input-group">
                                    <label>Confirm New Password</label>
                                    <div className="input-wrapper">
                                        <FiLock className="field-icon" />
                                        <input
                                            type="password"
                                            name="confirm_password"
                                            value={formData.confirm_password}
                                            onChange={handleChange}
                                            autoComplete="new-password"
                                        />
                                    </div>
                                </div>
                            </div>
                        </section>

                        {message && (
                            <div className={`status-message ${message.type}`}>
                                {message.type === "success" ? <FiCheckCircle /> : <FiAlertCircle />}
                                {message.text}
                            </div>
                        )}

                        <div className="form-actions">
                            <button type="submit" className="save-btn hover-lift" disabled={loading}>
                                {loading ? "Saving Changes..." : <><FiSave /> Save Changes</>}
                            </button>
                        </div>
                    </form>
                </div>
            </div>

            <style>{`
                .profile-page-container {
                    padding: 2rem;
                    animation: fadeIn 0.5s ease-out;
                    max-width: 1200px;
                    margin: 0 auto;
                }

                .page-header {
                    margin-bottom: 3rem;
                }

                .header-info h1 {
                    font-size: 2.2rem;
                    font-weight: 800;
                    background: linear-gradient(135deg, #fff 0%, #94a3b8 100%);
                    -webkit-background-clip: text;
                    -webkit-text-fill-color: transparent;
                    margin-bottom: 0.5rem;
                }

                .header-info p {
                    color: #94a3b8;
                    font-size: 1.1rem;
                }

                .profile-grid {
                    display: grid;
                    grid-template-columns: 350px 1fr;
                    gap: 2rem;
                    align-items: start;
                }

                .profile-card {
                    padding: 2.5rem;
                    border-radius: 20px;
                }

                /* Info Card Styles */
                .avatar-section {
                    text-align: center;
                    margin-bottom: 2.5rem;
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    gap: 1rem;
                }

                .avatar-placeholder {
                    width: 100px;
                    height: 100px;
                    background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%);
                    border-radius: 30px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    font-size: 2.5rem;
                    font-weight: 800;
                    color: white;
                    box-shadow: 0 10px 25px rgba(37, 99, 235, 0.3);
                }

                .avatar-section h2 {
                    font-size: 1.5rem;
                    font-weight: 700;
                    color: white;
                    margin: 0;
                    overflow-wrap: anywhere;
                    max-width: 100%;
                }

                .role-badge {
                    padding: 0.4rem 1rem;
                    background: rgba(59, 130, 246, 0.1);
                    border: 1px solid rgba(59, 130, 246, 0.2);
                    border-radius: 100px;
                    color: #3b82f6;
                    font-size: 0.75rem;
                    font-weight: 800;
                    letter-spacing: 0.05em;
                }

                .user-meta-list {
                    display: flex;
                    flex-direction: column;
                    gap: 1.5rem;
                }

                .meta-item {
                    display: flex;
                    align-items: flex-start;
                    gap: 1rem;
                }

                .meta-item .icon {
                    margin-top: 0.2rem;
                    font-size: 1.2rem;
                    color: #3b82f6;
                }

                .meta-item .text {
                    display: flex;
                    flex-direction: column;
                }

                .meta-item label {
                    font-size: 0.7rem;
                    font-weight: 800;
                    color: #64748b;
                    text-transform: uppercase;
                    letter-spacing: 0.05em;
                }

                .meta-item span {
                    color: #cbd5e1;
                    font-size: 0.95rem;
                    font-weight: 600;
                    word-break: break-all;
                }

                /* Form Card Styles */
                .form-section {
                    margin-bottom: 2.5rem;
                }

                .form-section:last-child {
                    margin-bottom: 0;
                }

                .form-section h3 {
                    display: flex;
                    align-items: center;
                    gap: 0.8rem;
                    font-size: 1.1rem;
                    font-weight: 700;
                    color: white;
                    margin-bottom: 1.5rem;
                    padding-bottom: 0.8rem;
                    border-bottom: 1px solid rgba(255, 255, 255, 0.05);
                }

                .section-hint {
                    font-size: 0.85rem;
                    color: #64748b;
                    margin-top: -1rem;
                    margin-bottom: 1.5rem;
                }

                .input-grid {
                    display: grid;
                    grid-template-columns: 1fr 1fr;
                    gap: 1.5rem;
                }

                .input-group label {
                    display: block;
                    font-size: 0.85rem;
                    font-weight: 600;
                    color: #94a3b8;
                    margin-bottom: 0.6rem;
                }

                .input-wrapper {
                    position: relative;
                }

                .field-icon {
                    position: absolute;
                    left: 1rem;
                    top: 50%;
                    transform: translateY(-50%);
                    color: #64748b;
                    pointer-events: none;
                }

                .input-wrapper input {
                    width: 100%;
                    background: rgba(0, 0, 0, 0.2);
                    border: 1px solid rgba(255, 255, 255, 0.08);
                    border-radius: 12px;
                    padding: 0.8rem 1rem 0.8rem 2.8rem;
                    color: white;
                    font-size: 1rem;
                    transition: all 0.3s;
                }

                .input-wrapper input:focus {
                    outline: none;
                    border-color: #3b82f6;
                    background: rgba(0, 0, 0, 0.3);
                    box-shadow: 0 0 0 4px rgba(59, 130, 246, 0.1);
                }

                .status-message {
                    display: flex;
                    align-items: center;
                    gap: 0.8rem;
                    padding: 1rem;
                    border-radius: 12px;
                    font-size: 0.95rem;
                    font-weight: 600;
                    margin-bottom: 2rem;
                }

                .status-message.success {
                    background: rgba(16, 185, 129, 0.1);
                    border: 1px solid rgba(16, 185, 129, 0.2);
                    color: #10b981;
                }

                .status-message.error {
                    background: rgba(239, 68, 68, 0.1);
                    border: 1px solid rgba(239, 68, 68, 0.2);
                    color: #ef4444;
                }

                .form-actions {
                    display: flex;
                    justify-content: flex-end;
                }

                .save-btn {
                    background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%);
                    color: white;
                    border: none;
                    padding: 1rem 2rem;
                    border-radius: 12px;
                    font-size: 1rem;
                    font-weight: 700;
                    display: flex;
                    align-items: center;
                    gap: 0.8rem;
                    cursor: pointer;
                    box-shadow: 0 10px 20px rgba(37, 99, 235, 0.2);
                }

                .save-btn:disabled {
                    opacity: 0.7;
                    cursor: not-allowed;
                }

                @keyframes fadeIn {
                    from { opacity: 0; transform: translateY(10px); }
                    to { opacity: 1; transform: translateY(0); }
                }

                @media (max-width: 1024px) {
                    .profile-grid {
                        grid-template-columns: 1fr;
                    }
                }

                @media (max-width: 640px) {
                    .input-grid {
                        grid-template-columns: 1fr;
                    }
                }
            `}</style>
        </div>
    );
};

export default ProfilePage;
