import React, { useEffect, useMemo, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import apiClient from "../api/client";
import ReactQuill from "react-quill";
import "react-quill/dist/quill.snow.css";
import {
  hasMaxLength,
  hasMinLength,
  isBlank,
  stripHtml,
} from "../utils/validation";

const steps = ["Issue Details", "Impact", "Attachments"];

const categories = [
  "Hardware",
  "Software",
  "Access Request",
  "Account Creation",
  "Network",
  "Other",
];

const locations = ["Philippines", "US", "Indonesia", "China", "Other"];
const priorities = ["P1", "P2", "P3", "P4"];
const ticketTypes = [
  { value: "incident", label: "Incident" },
  { value: "request", label: "Request" },
];

const NewTicketPage = ({ onCreated }) => {
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [assets, setAssets] = useState([]);
  const [selectedAssetId, setSelectedAssetId] = useState("");
  const [duplicates, setDuplicates] = useState([]);
  const [duplicateConflict, setDuplicateConflict] = useState(null);
  const confirmDuplicateRef = useRef(false);
  const [templates, setTemplates] = useState([]);
  const [templatesLoading, setTemplatesLoading] = useState(true);
  const [selectedTemplateId, setSelectedTemplateId] = useState("");
  const [form, setForm] = useState({
    title: "",
    category: "",
    location: "",
    priority: "",
    ticket_type: "incident",
    description: "",
    business_impact: "",
    tags: "",
  });
  const [files, setFiles] = useState([]);
  const [searchingDuplicates, setSearchingDuplicates] = useState(false);
  const searchTimeoutRef = useRef(null);

  const location = useLocation();

  const totalSize = useMemo(
    () => files.reduce((sum, file) => sum + file.size, 0),
    [files],
  );

  useEffect(() => {
    const loadAssets = async () => {
      try {
        const res = await apiClient.get("/assets");
        setAssets(res.data.data.assets || []);
      } catch (err) {
        setAssets([]);
      }
    };

    const loadTemplates = async () => {
      setTemplatesLoading(true);
      try {
        const res = await apiClient.get("/ticket-templates");
        setTemplates(res.data.data?.templates || []);
      } catch (err) {
        setTemplates([]);
      } finally {
        setTemplatesLoading(false);
      }
    };

    loadAssets();
    loadTemplates();

    // Pre-fill ticket type from query param
    const params = new URLSearchParams(location.search);
    const typeParam = params.get("type");
    if (typeParam && ["incident", "request"].includes(typeParam)) {
      setForm((prev) => ({ ...prev, ticket_type: typeParam }));
    }
  }, [location.search]);

  const applyTemplate = React.useCallback((template) => {
    if (!template) return;
    // Apply ALL template values IMMEDIATELY - use functional update to preserve other fields
    setForm((prev) => ({
      ...prev,
      title: template.title || "",
      category: template.category || "",
      description: template.description || "",
      business_impact: template.business_impact || "",
      priority: template.priority || "",
    }));

    // Show instant success feedback
    const filledFields = [];
    if (template.title) filledFields.push("Title");
    if (template.category) filledFields.push("Category");
    if (template.priority) filledFields.push("Priority");
    if (template.description) filledFields.push("Description");
    if (template.business_impact) filledFields.push("Business Impact");

    if (filledFields.length > 0) {
      setSuccess(`✓ Template "${template.name}" applied! Fields filled: ${filledFields.join(", ")}`);
      setTimeout(() => setSuccess(""), 3000);
    }
  }, []);

  // Safety net: Apply template when templates load if one was already selected
  // (Edge case: user selects template before templates finish loading)
  useEffect(() => {
    if (!selectedTemplateId || templates.length === 0) return;
    const template = templates.find(
      (item) => String(item.template_id) === String(selectedTemplateId),
    );
    if (template) {
      // Only apply if form doesn't match template (templates just loaded)
      const needsApply =
        form.title !== (template.title || "") ||
        form.category !== (template.category || "");
      if (needsApply) {
        applyTemplate(template);
      }
    }
  }, [templates]); // Trigger when templates array is populated

  useEffect(() => {
    if (form.title.trim().length < 4) {
      setDuplicates([]);
      return;
    }

    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    searchTimeoutRef.current = setTimeout(async () => {
      setSearchingDuplicates(true);
      try {
        const res = await apiClient.get("/tickets/check-duplicates", {
          params: { title: form.title.trim() }
        });
        setDuplicates(res.data.data.duplicates || []);
      } catch (err) {
        console.error("Duplicate check failed", err);
      } finally {
        setSearchingDuplicates(false);
      }
    }, 600);

    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, [form.title]);

  const validateIssueDetails = () => {
    const title = form.title.trim();
    const descriptionText = stripHtml(form.description);
    const missing = [];
    if (!hasMinLength(title, 5)) missing.push("Ticket title (at least 5 characters)");
    if (!hasMaxLength(title, 255)) return "Ticket title must be 255 characters or less.";
    if (isBlank(form.category)) missing.push("Category");
    if (isBlank(form.location)) missing.push("Location");
    if (!hasMinLength(descriptionText, 10)) missing.push("Description (at least 10 characters)");
    if (missing.length > 0) {
      return `Please fill in: ${missing.join(", ")}`;
    }
    return "";
  };

  const validateImpact = () => {
    if (!hasMinLength(form.business_impact, 10)) {
      return "Business impact must be at least 10 characters.";
    }
    return "";
  };

  const validateStep = () => {
    if (step === 0) return !validateIssueDetails();
    if (step === 1) return !validateImpact();
    return true;
  };

  const handleFileChange = (event) => {
    const selected = Array.from(event.target.files || []);
    const valid = [];
    for (const file of selected) {
      if (file.size > 10 * 1024 * 1024) {
        setError(`File too large (10MB max): ${file.name}`);
        continue;
      }
      valid.push(file);
    }

    const combined = [...files, ...valid];
    const combinedSize = combined.reduce((sum, file) => sum + file.size, 0);
    if (combinedSize > 50 * 1024 * 1024) {
      setError("Total attachments must be below 50MB.");
      return;
    }

    setFiles(combined);
    setError("");
  };

  const handleRemoveFile = (indexToRemove) => {
    setFiles((current) => current.filter((_, index) => index !== indexToRemove));
  };

  const handleSubmit = async () => {
    const issueError = validateIssueDetails();
    const impactError = validateImpact();
    if (issueError || impactError) {
      setError(issueError || impactError);
      return;
    }
    setError("");
    setSuccess("");
    setDuplicateConflict(null);
    setLoading(true);

    const confirmDuplicate = confirmDuplicateRef.current;
    confirmDuplicateRef.current = false;

    const idempotencyKey = `ticket-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const headers = { "X-Idempotency-Key": idempotencyKey };

    try {
      let ticket;
      if (files.length > 0) {
        const formData = new FormData();
        Object.entries(form).forEach(([k, v]) => {
          if (v != null && v !== "") formData.append(k, v);
        });
        if (confirmDuplicate) formData.append("confirm_duplicate", "true");
        files.forEach((file) => formData.append("files", file));
        const res = await apiClient.post("/tickets/with-attachments", formData, {
          headers: { ...headers, "Content-Type": "multipart/form-data" },
        });
        ticket = res.data.data.ticket;
        setDuplicates(res.data.data.possible_duplicates || []);
      } else {
        const payload = { ...form };
        if (confirmDuplicate) payload.confirm_duplicate = true;
        const res = await apiClient.post("/tickets", payload, { headers });
        ticket = res.data.data.ticket;
        setDuplicates(res.data.data.possible_duplicates || []);
      }

      if (selectedAssetId) {
        try {
          await apiClient.post(`/assets/${selectedAssetId}/link-ticket`, {
            ticket_id: ticket.ticket_id,
          });
        } catch (err) {
          setError(
            err.response?.data?.message ||
            "Ticket created, but asset link failed",
          );
        }
      }

      setSuccess(`Ticket created: ${ticket.ticket_number}`);
      setForm({
        title: "",
        category: "",
        location: "",
        priority: "",
        ticket_type: "incident",
        description: "",
        business_impact: "",
        tags: "",
      });
      setSelectedTemplateId("");
      setFiles([]);
      setSelectedAssetId("");
      setStep(0);
      if (onCreated) onCreated(ticket);
    } catch (err) {
      if (err.response?.status === 409 && err.response?.data?.possible_duplicates) {
        setDuplicateConflict(err.response.data.possible_duplicates);
        setError(err.response?.data?.message || "Possible duplicate ticket.");
      } else {
        setError(err.response?.data?.message || "Failed to create ticket");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSubmitAnyway = () => {
    confirmDuplicateRef.current = true;
    setError("");
    setDuplicateConflict(null);
    handleSubmit();
  };

  return (
    <div className="panel" style={{ animation: 'slideUp 0.6s cubic-bezier(0.2, 0, 0, 1) both' }}>
      <div className="panel-header">
        <div>
          <h2>Create Ticket</h2>
          <p>Submit an issue or request and we will route it automatically.</p>
        </div>
      </div>

      <div className="steps">
        {steps.map((label, index) => (
          <div key={label} className={`step ${index <= step ? "active" : ""}`}>
            <span>{index + 1}</span>
            <p>{label}</p>
          </div>
        ))}
      </div>

      {error && (
        <div className="panel error">
          {error}
          {duplicateConflict && duplicateConflict.length > 0 && (
            <div className="attachment-list" style={{ marginTop: 12 }}>
              <strong>Similar tickets:</strong>
              {duplicateConflict.map((dup) => (
                <div key={dup.ticket_id} className="attachment-item">
                  <span>{dup.ticket_number}</span>
                  <span>{dup.title}</span>
                </div>
              ))}
              <button
                type="button"
                className="btn primary"
                style={{ marginTop: 8 }}
                onClick={handleSubmitAnyway}
                disabled={loading}
              >
                Submit anyway
              </button>
            </div>
          )}
        </div>
      )}
      {step === 0 && selectedTemplateId && !validateStep() && (
        <div className="panel" style={{ background: "#1a3a5c", border: "1px solid #3a5a7a", padding: "12px", borderRadius: "4px", marginBottom: "16px" }}>
          <strong style={{ color: "#ffd700" }}>⚠ Missing required fields:</strong>
          <div style={{ marginTop: "8px", fontSize: "14px" }}>
            {(() => {
              const validationMsg = validateIssueDetails();
              if (validationMsg) {
                return <span style={{ color: "#ffd700" }}>{validationMsg}</span>;
              }
              return null;
            })()}
          </div>
          <div style={{ marginTop: "8px", fontSize: "12px", color: "#a0c0e0" }}>
            Template applied. Please fill in the missing fields above to continue.
          </div>
        </div>
      )}
      {success && (
        <div className="panel success">
          {success}
          {duplicates.length > 0 && (
            <div className="attachment-list" style={{ marginTop: 12 }}>
              <strong>Possible duplicates:</strong>
              {duplicates.map((dup) => (
                <div key={dup.ticket_id} className="attachment-item">
                  <span>{dup.ticket_number}</span>
                  <span>{dup.title}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {step === 0 && (
        <div className="form-grid">
          <label className="field">
            <span>Template (optional)</span>
            <select
              value={selectedTemplateId}
              onChange={(e) => {
                const id = e.target.value;
                setSelectedTemplateId(id);
                setError(""); // Clear any previous errors

                // Apply template IMMEDIATELY when selected
                if (id) {
                  const template = templates.find(
                    (t) => String(t.template_id) === String(id),
                  );
                  if (template) {
                    // Apply template synchronously - no delay
                    applyTemplate(template);
                  } else {
                    setError("Template not found. Please refresh the page.");
                  }
                } else {
                  // Clear success message when deselected
                  setSuccess("");
                }
              }}
              disabled={templatesLoading}
            >
              <option value="">
                {templatesLoading ? "Loading templates..." : "Select template"}
              </option>
              {templates.map((template) => (
                <option key={template.template_id} value={template.template_id}>
                  {template.name}
                  {template.category ? ` (${template.category})` : ""}
                </option>
              ))}
            </select>
            {selectedTemplateId && (() => {
              const selectedTemplate = templates.find(
                (t) => String(t.template_id) === String(selectedTemplateId),
              );
              if (!selectedTemplate) return null;
              const filled = [];
              if (selectedTemplate.title) filled.push("Title");
              if (selectedTemplate.category) filled.push("Category");
              if (selectedTemplate.priority) filled.push("Priority");
              if (selectedTemplate.description) filled.push("Description");
              if (selectedTemplate.business_impact) filled.push("Business Impact");
              return (
                <small className="muted" style={{ color: "#4ade80", fontWeight: "500" }}>
                  ✓ Template applied: {filled.length > 0 ? filled.join(", ") : "No fields to fill"}
                  {filled.length > 0 && " - You can edit any field"}
                </small>
              );
            })()}
          </label>
          <label className="field">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>Ticket Title</span>
              {searchingDuplicates && <small className="muted" style={{ fontSize: '10px' }}>Checking for duplicates...</small>}
            </div>
            <input
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              placeholder="Brief summary of the issue"
            />
            {duplicates.length > 0 && (
              <div className="duplicates-suggestion" style={{
                marginTop: '8px',
                background: 'rgba(255, 215, 0, 0.05)',
                border: '1px solid rgba(255, 215, 0, 0.2)',
                borderRadius: '12px',
                padding: '12px'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px', color: '#ffd700', fontSize: '12px', fontWeight: '700' }}>
                  <span style={{ fontSize: '16px' }}>⚠</span>
                  <span>SIMILAR TICKETS FOUND</span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {duplicates.map(dup => (
                    <div key={dup.ticket_id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '11px', color: 'var(--slate-300)', padding: '4px 0' }}>
                      <span style={{ fontWeight: '600', color: 'var(--cyan-300)' }}>{dup.ticket_number}</span>
                      <span style={{ flex: 1, margin: '0 8px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{dup.title}</span>
                      <span className={`status-pill ${dup.status.toLowerCase().replace(' ', '-')}`} style={{ fontSize: '9px', padding: '2px 8px' }}>{dup.status}</span>
                    </div>
                  ))}
                </div>
                <p style={{ fontSize: '10px', color: 'var(--slate-500)', marginTop: '8px', borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '8px' }}>
                  Please check if your issue is already being handled to avoid duplicate tickets.
                </p>
              </div>
            )}
          </label>
          <label className="field">
            <span>Category</span>
            <select
              value={form.category}
              onChange={(e) => setForm({ ...form, category: e.target.value })}
            >
              <option value="">Select category</option>
              {categories.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>Location</span>
            <select
              value={form.location}
              onChange={(e) => setForm({ ...form, location: e.target.value })}
            >
              <option value="">Select location</option>
              {locations.map((loc) => (
                <option key={loc} value={loc}>
                  {loc}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>Ticket Type</span>
            <select
              value={form.ticket_type}
              onChange={(e) =>
                setForm({ ...form, ticket_type: e.target.value })
              }
            >
              {ticketTypes.map((type) => (
                <option key={type.value} value={type.value}>
                  {type.label}
                </option>
              ))}
            </select>
            <small className="muted">
              Incident = unplanned interruption. Request = formal request from a user for something to be provided.
            </small>
          </label>
          <label className="field">
            <span>Priority (optional)</span>
            <select
              value={form.priority}
              onChange={(e) => setForm({ ...form, priority: e.target.value })}
            >
              <option value="">Auto</option>
              {priorities.map((priority) => (
                <option key={priority} value={priority}>
                  {priority}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>Related Asset (optional)</span>
            <select
              value={selectedAssetId}
              onChange={(e) => setSelectedAssetId(e.target.value)}
            >
              <option value="">Select your asset</option>
              {assets.map((asset) => (
                <option key={asset.asset_id} value={asset.asset_id}>
                  {asset.asset_tag} ({asset.asset_type})
                </option>
              ))}
            </select>
            {assets.length === 0 && (
              <small className="muted">
                No assets assigned to your account.
              </small>
            )}
          </label>
          <label className="field">
            <span>Tags (optional)</span>
            <input
              value={form.tags}
              onChange={(e) => setForm({ ...form, tags: e.target.value })}
              placeholder="Example: vpn, urgent, onboarding"
            />
          </label>
          <label className="field full">
            <span>Detailed Description</span>
            <ReactQuill
              value={form.description}
              onChange={(value) => setForm({ ...form, description: value })}
              className="editor"
            />
          </label>
        </div>
      )}

      {step === 1 && (
        <div className="form-grid">
          <label className="field full">
            <span>Business Impact</span>
            <textarea
              rows={5}
              value={form.business_impact}
              onChange={(e) =>
                setForm({ ...form, business_impact: e.target.value })
              }
              placeholder="Describe the impact on operations, users, or deadlines."
            />
          </label>
        </div>
      )}

      {step === 2 && (
        <div className="form-grid">
          <label className="field full">
            <span>Attachments (optional)</span>
            <input type="file" multiple onChange={handleFileChange} />
            <small>
              Any file type. Max 10MB each, 50MB total.
            </small>
          </label>
          <div className="attachment-list">
            {files.map((file, index) => (
              <div key={`${file.name}-${index}`} className="attachment-item">
                <div>
                  <span>{file.name}</span>
                </div>
                <div className="attachment-actions">
                  <span>{(file.size / 1024 / 1024).toFixed(2)} MB</span>
                  <button
                    type="button"
                    className="attachment-remove"
                    onClick={() => handleRemoveFile(index)}
                    aria-label={`Remove ${file.name}`}
                  >
                    ×
                  </button>
                </div>
              </div>
            ))}
            {files.length > 0 && (
              <div className="attachment-total">
                Total: {(totalSize / 1024 / 1024).toFixed(2)} MB
              </div>
            )}
          </div>
        </div>
      )}

      <div className="form-actions">
        <button
          className="btn ghost"
          type="button"
          disabled={step === 0}
          onClick={() => setStep(step - 1)}
        >
          Back
        </button>
        {step < steps.length - 1 ? (
          <button
            className="btn primary btn-press"
            type="button"
            onClick={() => {
              const validationMessage =
                step === 0 ? validateIssueDetails() : validateImpact();
              if (validationMessage) {
                setError(validationMessage);
                return;
              }
              setError("");
              setStep(step + 1);
            }}
            style={{
              opacity: !validateStep() ? 0.6 : 1,
              cursor: !validateStep() ? "not-allowed" : "pointer",
            }}
            title={!validateStep() ? (step === 0 ? validateIssueDetails() || "Please fill all required fields" : validateImpact() || "Please fill all required fields") : ""}
          >
            Next
          </button>
        ) : (
          <button
            className="btn primary btn-press"
            type="button"
            disabled={!validateStep() || loading}
            onClick={handleSubmit}
          >
            {loading ? "Submitting..." : "Submit Ticket"}
          </button>
        )}
      </div>
    </div>
  );
};

export default NewTicketPage;
