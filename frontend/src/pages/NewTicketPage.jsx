import React, { useEffect, useMemo, useRef, useState } from "react";
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

const locations = ["Philippines", "US", "Indonesia", "Other"];
const priorities = ["P1", "P2", "P3", "P4"];
const ticketTypes = [
  { value: "incident", label: "Incident" },
  { value: "request", label: "Request" },
];

const allowedExtensions = [
  ".pdf",
  ".png",
  ".jpg",
  ".jpeg",
  ".xlsx",
  ".docx",
  ".msg",
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
      try {
        const res = await apiClient.get("/ticket-templates");
        setTemplates(res.data.data.templates || []);
      } catch (err) {
        setTemplates([]);
      }
    };

    loadAssets();
    loadTemplates();
  }, []);

  useEffect(() => {
    if (!selectedTemplateId) return;
    const template = templates.find(
      (item) => item.template_id === selectedTemplateId,
    );
    if (!template) return;
    setForm((prev) => ({
      ...prev,
      title: template.title || prev.title,
      category: template.category || prev.category,
      description: template.description || prev.description,
      business_impact: template.business_impact || prev.business_impact,
      priority: template.priority || prev.priority,
    }));
  }, [selectedTemplateId, templates]);

  const validateIssueDetails = () => {
    const title = form.title.trim();
    const descriptionText = stripHtml(form.description);
    if (!hasMinLength(title, 5)) return "Ticket title must be at least 5 characters.";
    if (!hasMaxLength(title, 255)) return "Ticket title must be 255 characters or less.";
    if (isBlank(form.category)) return "Category is required.";
    if (isBlank(form.location)) return "Location is required.";
    if (!hasMinLength(descriptionText, 10)) {
      return "Description must be at least 10 characters.";
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
      const ext = `.${file.name.split(".").pop()}`.toLowerCase();
      if (!allowedExtensions.includes(ext)) {
        setError(`Unsupported file type: ${file.name}`);
        continue;
      }
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
    <div className="panel">
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
              onChange={(e) => setSelectedTemplateId(e.target.value)}
            >
              <option value="">Select template</option>
              {templates.map((template) => (
                <option key={template.template_id} value={template.template_id}>
                  {template.name}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>Ticket Title</span>
            <input
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              placeholder="Brief summary of the issue"
            />
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
              Incident = something is broken. Request = you need something new.
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
              Max 10MB each, 50MB total. Supported:{" "}
              {allowedExtensions.join(", ")}
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
            className="btn primary"
            type="button"
            disabled={!validateStep()}
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
          >
            Next
          </button>
        ) : (
          <button
            className="btn primary"
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
