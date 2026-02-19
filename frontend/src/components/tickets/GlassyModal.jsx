import React from "react";

const GlassyModal = ({ isOpen, onClose, title, children, footer, maxWidth = "600px" }) => {
    if (!isOpen) return null;

    return (
        <div className="glassy-modal-overlay animate-fade-in" onClick={onClose}>
            <div
                className="glassy-modal-container animate-slide-up"
                onClick={e => e.stopPropagation()}
                style={{ maxWidth }}
            >
                <div className="modal-header">
                    <h2>{title}</h2>
                    <button className="close-btn" onClick={onClose}>&times;</button>
                </div>
                <div className="modal-content">
                    {children}
                </div>
                {footer && (
                    <div className="modal-footer">
                        {footer}
                    </div>
                )}
            </div>

            <style>{`
                .glassy-modal-overlay {
                    position: fixed;
                    top: 0;
                    left: 0;
                    right: 0;
                    bottom: 0;
                    background: rgba(15, 23, 42, 0.8);
                    backdrop-filter: blur(12px);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    z-index: 1000;
                    padding: 2rem;
                }

                .glassy-modal-container {
                    background: rgba(30, 41, 59, 0.7);
                    border: 1px solid rgba(255, 255, 255, 0.1);
                    border-radius: 20px;
                    width: 100%;
                    max-width: 600px;
                    max-height: 90vh;
                    display: flex;
                    flex-direction: column;
                    box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
                    overflow: hidden;
                }

                .modal-header {
                    padding: 1.5rem 2rem;
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    border-bottom: 1px solid rgba(255, 255, 255, 0.05);
                }
                .modal-header h2 {
                    margin: 0;
                    font-size: 1.25rem;
                    font-weight: 800;
                    color: #f8fafc;
                    letter-spacing: -0.02em;
                }
                .close-btn {
                    background: transparent;
                    border: none;
                    color: #94a3b8;
                    font-size: 1.5rem;
                    cursor: pointer;
                    transition: color 0.2s;
                    line-height: 1;
                }
                .close-btn:hover { color: white; }

                .modal-content {
                    padding: 2rem;
                    overflow-y: auto;
                    color: #cbd5e1;
                    font-size: 0.95rem;
                    line-height: 1.6;
                }

                .modal-footer {
                    padding: 1.5rem 2rem;
                    border-top: 1px solid rgba(255, 255, 255, 0.05);
                    display: grid;
                    grid-template-columns: 1fr 1fr;
                    gap: 1rem;
                    background: rgba(15, 23, 42, 0.3);
                }
                .modal-footer > *:only-child {
                    grid-column: 1 / -1;
                }
                .modal-btn {
                    width: 100%;
                }

                .animate-fade-in { animation: fadeIn 0.3s ease-out; }
                .animate-slide-up { animation: slideUp 0.3s cubic-bezier(0.16, 1, 0.3, 1); }

                @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
                @keyframes slideUp { from { transform: translateY(20px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
            `}</style>
        </div>
    );
};

export default GlassyModal;
