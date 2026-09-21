"use client";

import { ChangeEvent, useEffect, useMemo, useRef, useState } from "react";

type View = "Overview" | "Brief" | "Search" | "References" | "Review" | "Approved" | "Export";
type Film = string;
type Status = "Inbox" | "Candidate" | "Shortlisted" | "Cleaning" | "Ready for review" | "Changes requested" | "Approved" | "Rejected" | "Exported";

type Reference = {
  id: string;
  title: string;
  provider: string;
  url: string;
  film: Film;
  section: string;
  beat: string;
  role: string;
  status: Status;
  note: string;
  image: string;
  kind: "STILL" | "VIDEO" | "GIF";
  duration?: string;
  rights: string;
  decision?: string;
  comment?: string;
  derivativeVersion: number;
};

type Project = {
  id: string;
  name: string;
  brand: string;
  director: string;
  designer: string;
  dueDate: string;
};

const statuses: Status[] = ["Inbox", "Candidate", "Shortlisted", "Cleaning", "Ready for review", "Changes requested", "Approved"];
const navItems: { label: View; glyph: string }[] = [
  { label: "Overview", glyph: "01" }, { label: "Brief", glyph: "02" }, { label: "Search", glyph: "03" },
  { label: "References", glyph: "04" }, { label: "Review", glyph: "05" }, { label: "Approved", glyph: "06" }, { label: "Export", glyph: "07" },
];

const providerFromUrl = (url: string) => {
  const lower = url.toLowerCase();
  if (lower.includes("youtu")) return "YouTube";
  if (lower.includes("vimeo")) return "Vimeo";
  if (lower.includes("instagram")) return "Instagram";
  if (lower.includes("pinterest") || lower.includes("pin.it")) return "Pinterest";
  return "Web";
};

const neutralPreview = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 800 500'%3E%3Crect width='800' height='500' fill='%23233229'/%3E%3Ccircle cx='400' cy='220' r='72' fill='%23d8fa3f'/%3E%3Cpath d='M380 182l66 38-66 38z' fill='%2317251d'/%3E%3Ctext x='400' y='340' text-anchor='middle' fill='%23dfe7df' font-family='Arial,sans-serif' font-size='28'%3ELINKED REFERENCE%3C/text%3E%3C/svg%3E";

export default function PitchItApp() {
  const [enteredWorkspace, setEnteredWorkspace] = useState(false);
  const [active, setActive] = useState<View>("Overview");
  const [project, setProject] = useState<Project | null>(null);
  const [references, setReferences] = useState<Reference[]>([]);
  const [query, setQuery] = useState("");
  const [filmFilter, setFilmFilter] = useState<string>("All");
  const [statusFilter, setStatusFilter] = useState<"All" | Status>("All");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [projectModalOpen, setProjectModalOpen] = useState(false);
  const [projectDraft, setProjectDraft] = useState({ name: "", brand: "", director: "", designer: "", dueDate: "" });
  const [guideStep, setGuideStep] = useState<number | null>(null);
  const [captureOpen, setCaptureOpen] = useState(false);
  const [captureText, setCaptureText] = useState("");
  const [captureFilm, setCaptureFilm] = useState<Film>("General");
  const [captureNote, setCaptureNote] = useState("");
  const [cleanerId, setCleanerId] = useState<string | null>(null);
  const [reviewId, setReviewId] = useState<string | null>(null);
  const [reviewComment, setReviewComment] = useState("");
  const [toast, setToast] = useState("");
  const [saving, setSaving] = useState<"Saved" | "Saving" | "Offline">("Saving");
  const [exported, setExported] = useState(false);
  const [mobileNav, setMobileNav] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  const selected = references.find((reference) => reference.id === selectedId) ?? null;
  const reviewItem = references.find((reference) => reference.id === reviewId) ?? null;
  const cleanerItem = references.find((reference) => reference.id === cleanerId) ?? null;

  useEffect(() => {
    fetch("/api/workspace")
      .then((response) => response.ok ? response.json() : Promise.reject())
      .then((payload: { state?: { schemaVersion?: number; project?: Project | null; references?: Reference[]; exported?: boolean } }) => {
        if (payload.state?.schemaVersion === 2) {
          setProject(payload.state.project ?? null);
          setReferences(payload.state.references ?? []);
          setExported(Boolean(payload.state.exported));
        }
        setSaving("Saved");
      })
      .catch(() => setSaving("Offline"))
      .finally(() => setHydrated(true));
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    const timer = window.setTimeout(() => {
      setSaving("Saving");
      fetch("/api/workspace", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ schemaVersion: 2, project, references, exported }),
      }).then((response) => setSaving(response.ok ? "Saved" : "Offline")).catch(() => setSaving("Offline"));
    }, 700);
    return () => window.clearTimeout(timer);
  }, [project, references, exported, hydrated]);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(""), 2600);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const counts = useMemo(() => ({
    total: references.length,
    review: references.filter((item) => ["Ready for review", "Changes requested"].includes(item.status)).length,
    approved: references.filter((item) => ["Approved", "Exported"].includes(item.status)).length,
    organised: references.filter((item) => item.status !== "Inbox").length,
  }), [references]);

  const filtered = useMemo(() => references.filter((item) => {
    const haystack = `${item.title} ${item.note} ${item.provider} ${item.beat} ${item.section}`.toLowerCase();
    return (filmFilter === "All" || item.film === filmFilter)
      && (statusFilter === "All" || item.status === statusFilter)
      && (!query || haystack.includes(query.toLowerCase()));
  }), [references, filmFilter, statusFilter, query]);

  const updateReference = (id: string, patch: Partial<Reference>) => {
    setReferences((current) => current.map((item) => item.id === id ? { ...item, ...patch } : item));
  };

  const navigate = (view: View) => {
    setActive(view);
    setMobileNav(false);
    if (view !== "References") setSelectedId(null);
  };

  const createProject = () => {
    const name = projectDraft.name.trim();
    if (!name) {
      setToast("Give your project a name first");
      return;
    }
    setProject({ id: crypto.randomUUID(), ...projectDraft, name });
    setReferences([]);
    setExported(false);
    setSelectedId(null);
    setActive("Overview");
    setProjectModalOpen(false);
    setProjectDraft({ name: "", brand: "", director: "", designer: "", dueDate: "" });
    setGuideStep(0);
    setToast(`${name} is ready`);
  };

  const openNewProject = () => {
    setProjectDraft({ name: "", brand: "", director: "", designer: "", dueDate: "" });
    setProjectModalOpen(true);
  };

  const addCapturedReferences = () => {
    const urls = captureText.split(/\s+/).map((value) => value.trim()).filter((value) => /^https?:\/\//.test(value));
    if (!urls.length) {
      setToast("Paste at least one valid link");
      return;
    }
    const existing = new Set(references.map((item) => item.url.replace(/\?.*$/, "")));
    let duplicateCount = 0;
    const created: Reference[] = [];
    urls.forEach((url, index) => {
      const canonical = url.replace(/\?.*$/, "");
      if (existing.has(canonical)) { duplicateCount += 1; return; }
      const provider = providerFromUrl(url);
      created.push({
        id: `ref-${Date.now()}-${index}`,
        title: `${provider} reference`, provider, url, film: captureFilm.trim() || "General", section: "Unassigned",
        beat: "Unassigned", role: "Mood / world", status: "Inbox",
        note: captureNote || "Add a creative note", image: neutralPreview,
        kind: provider === "Pinterest" ? "STILL" : "VIDEO", duration: provider === "Pinterest" ? undefined : "0:12",
        rights: provider === "YouTube" ? "Link only" : "Unknown", derivativeVersion: 1,
      });
    });
    setReferences((current) => [...created, ...current]);
    setCaptureOpen(false);
    setCaptureText("");
    setCaptureNote("");
    setFilmFilter("All");
    setActive("References");
    setToast(`${created.length} reference${created.length === 1 ? "" : "s"} added${duplicateCount ? ` · ${duplicateCount} duplicate skipped` : ""}`);
  };

  const uploadFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const form = new FormData();
    form.append("file", file);
    setToast("Uploading authorised media…");
    try {
      const response = await fetch("/api/uploads", { method: "POST", body: form });
      const payload = await response.json() as { key?: string; error?: string };
      if (!response.ok) throw new Error(payload.error);
      const created: Reference = {
        id: `ref-${Date.now()}`, title: file.name.replace(/\.[^.]+$/, ""), provider: "Local upload", url: payload.key ?? file.name,
        film: captureFilm.trim() || "General", section: "Unassigned", beat: "Unassigned", role: "Action / shot",
        status: "Inbox", note: captureNote || "Authorised uploaded source", image: URL.createObjectURL(file),
        kind: file.type.includes("gif") ? "GIF" : file.type.startsWith("video") ? "VIDEO" : "STILL", rights: "User confirmed", derivativeVersion: 1,
      };
      setReferences((current) => [created, ...current]);
      setCaptureOpen(false);
      setActive("References");
      setToast("Media uploaded to the project inbox");
    } catch {
      setToast("Upload is available after the hosted media store connects");
    }
    event.target.value = "";
  };

  const decide = (decision: "Approved" | "Changes requested" | "Rejected") => {
    if (!reviewItem) return;
    updateReference(reviewItem.id, { status: decision, decision, comment: reviewComment || undefined });
    setReviewId(null);
    setReviewComment("");
    setToast(decision === "Approved" ? "Reference approved" : decision === "Rejected" ? "Reference rejected" : "Change request sent to the designer");
  };

  const createDerivative = () => {
    if (!cleanerItem) return;
    updateReference(cleanerItem.id, { status: "Ready for review", derivativeVersion: cleanerItem.derivativeVersion + 1, kind: "GIF", duration: "0:04" });
    setCleanerId(null);
    setToast(`New derivative v${cleanerItem.derivativeVersion + 1} is ready for review`);
  };

  const downloadManifest = () => {
    const approved = references.filter((item) => ["Approved", "Exported"].includes(item.status));
    const blob = new Blob([JSON.stringify({ project: project?.name ?? "Untitled project", exportedAt: new Date().toISOString(), references: approved }, null, 2)], { type: "application/json" });
    const href = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = href;
    anchor.download = `${(project?.name ?? "project").toLowerCase().replace(/[^a-z0-9]+/g, "-")}-pitchit-manifest.json`;
    anchor.click();
    URL.revokeObjectURL(href);
  };

  if (!enteredWorkspace) {
    return <PublicHome onEnter={() => setEnteredWorkspace(true)} />;
  }

  if (!hydrated) {
    return <div className="launch-screen"><div className="wordmark launch-wordmark">Pitch it.</div><div className="launch-loading"><i /><p>Opening your workspace…</p></div></div>;
  }

  if (!project) {
    return <>
      <ProjectLauncher onCreate={() => setProjectModalOpen(true)} onHome={() => setEnteredWorkspace(false)} />
      {projectModalOpen && <ProjectModal draft={projectDraft} onDraft={setProjectDraft} onClose={() => setProjectModalOpen(false)} onCreate={createProject} />}
      {toast && <div className="toast" role="status"><span>✓</span>{toast}</div>}
    </>;
  }

  return (
    <main className="app-shell">
      <aside className={`side-rail ${mobileNav ? "mobile-open" : ""}`} data-tour="navigation">
        <button className="wordmark wordmark-home-button" onClick={() => setEnteredWorkspace(false)} aria-label="Return to the Pitch it. homepage">Pitch it.</button>
        <button className="mobile-close" onClick={() => setMobileNav(false)} aria-label="Close navigation">×</button>
        <nav aria-label="Project navigation">
          <p className="nav-label">Workspace</p>
          {navItems.map((item) => (
            <button data-nav={item.label} onClick={() => navigate(item.label)} className={active === item.label ? "nav-item active" : "nav-item"} key={item.label}>
              <span className="nav-index">{item.glyph}</span>{item.label}
              {item.label === "References" && <b>{counts.total}</b>}
              {item.label === "Review" && counts.review > 0 && <b>{counts.review}</b>}
              {item.label === "Approved" && <b>{counts.approved}</b>}
            </button>
          ))}
        </nav>
        <div className="rail-progress">
          <div><span style={{ width: `${Math.max(8, (counts.organised / Math.max(counts.total, 1)) * 100)}%` }} /></div>
          <p><b>{counts.organised}</b> of {counts.total} organised</p>
        </div>
        <div className="rail-project">
          <span className="project-tile">{project.name.slice(0,2).toUpperCase()}</span>
          <div><strong>{project.name}</strong><small>{project.dueDate ? `Due ${formatDate(project.dueDate)}` : "No due date"} · Active</small></div>
          <button onClick={openNewProject} aria-label="Create a new project" title="Create a new project">＋</button>
        </div>
      </aside>

      <section className={`workspace ${selected && active === "References" ? "with-inspector" : ""}`}>
        <header className="topbar">
          <button className="mobile-menu" onClick={() => setMobileNav(true)} aria-label="Open navigation">☰</button>
          <div className="page-identity"><p className="eyebrow">{project.name.toUpperCase()} / {active.toUpperCase()}</p><h1>{viewTitle(active)}</h1></div>
          <div className="top-actions">
            <label className="search-field"><span>⌕</span><input value={query} onChange={(event) => setQuery(event.target.value)} aria-label="Search project" placeholder="Search the project" /></label>
            <span className="build-badge" title="This public preview does not store real client projects">PILOT PREVIEW</span>
            <button className="help-button" data-tour="help" onClick={() => setGuideStep(0)} aria-label="Start app guide">? <span>Guide</span></button>
            <span className={`save-state ${saving.toLowerCase()}`}>{saving === "Saved" ? "● Saved" : saving === "Saving" ? "○ Saving" : "○ Local"}</span>
            <button className="avatar" disabled title="Accounts are not used in the localhost pilot" aria-label="Profile unavailable in the localhost pilot">DA</button>
          </div>
        </header>

        {active !== "Overview" && <WorkflowBar active={active} counts={counts} />}

        <div className="page-content">
          {active === "Overview" && <OverviewView project={project} counts={counts} references={references} onNavigate={navigate} />}
          {active === "Brief" && <BriefView project={project} onSearch={() => navigate("Search")} />}
          {active === "Search" && <SearchView references={references} onCapture={() => setCaptureOpen(true)} onOpen={(id) => { setSelectedId(id); navigate("References"); }} />}
          {active === "References" && (
            <ReferencesView
              references={filtered} counts={counts} filmFilter={filmFilter} statusFilter={statusFilter} selectedId={selectedId}
              onFilm={setFilmFilter} onStatus={setStatusFilter} onSelect={setSelectedId} onCapture={() => setCaptureOpen(true)}
            />
          )}
          {active === "Review" && <ReviewView references={references} onReview={setReviewId} onOpen={(id) => { setSelectedId(id); navigate("References"); }} />}
          {active === "Approved" && <ApprovedView references={references} onOpen={(id) => { setSelectedId(id); navigate("References"); }} onExport={() => navigate("Export")} />}
          {active === "Export" && <ExportView project={project} references={references} exported={exported} onExport={() => { setExported(true); setToast("Local manifest prepared for download"); }} onManifest={downloadManifest} />}
        </div>
      </section>

      {selected && active === "References" && (
        <Inspector reference={selected} onClose={() => setSelectedId(null)} onUpdate={(patch) => updateReference(selected.id, patch)} onClean={() => setCleanerId(selected.id)} onReview={() => { updateReference(selected.id, { status: "Ready for review" }); setToast("Added to the review queue"); }} />
      )}

      {projectModalOpen && <ProjectModal draft={projectDraft} onDraft={setProjectDraft} onClose={() => setProjectModalOpen(false)} onCreate={createProject} replacing />}

      {captureOpen && (
        <Modal title="Add references" kicker="CAPTURE TO INBOX" onClose={() => setCaptureOpen(false)} wide>
          <div className="capture-layout">
            <div className="capture-main">
              <label className="field-label" htmlFor="capture-links">Paste one or many links</label>
              <textarea id="capture-links" value={captureText} onChange={(event) => setCaptureText(event.target.value)} placeholder={"https://vimeo.com/…\nhttps://in.pinterest.com/pin/…\nhttps://youtube.com/watch?v=…"} />
              <p className="field-help">Pitch it. detects the provider, keeps the original source, and warns about duplicate URLs.</p>
              <button className="upload-zone" onClick={() => fileInput.current?.click()}>
                <span>↑</span><strong>Upload authorised media</strong><small>Images, GIFs and MP4 · originals stay private</small>
              </button>
              <input ref={fileInput} className="hidden-input" type="file" accept="image/*,video/mp4" onChange={uploadFile} />
            </div>
            <div className="capture-fields">
              <label>Film or group<input value={captureFilm} onChange={(event) => setCaptureFilm(event.target.value)} placeholder="e.g. Film 1 or Project-wide" /></label>
              <label>Intended role<select><option>Mood / world</option><option>Action / shot</option><option>Character / performance</option><option>Product</option><option>Layout</option></select></label>
              <label>Creative note<textarea value={captureNote} onChange={(event) => setCaptureNote(event.target.value)} placeholder="What is useful here?" /></label>
              <div className="capture-tip"><b>Good capture has context.</b><p>A quick note now makes this reference searchable and reusable later.</p></div>
            </div>
          </div>
          <div className="modal-actions"><button className="quiet-button" onClick={() => setCaptureOpen(false)}>Cancel</button><button className="primary-button" onClick={addCapturedReferences}>Save to inbox</button></div>
        </Modal>
      )}

      {cleanerItem && <Cleaner reference={cleanerItem} onClose={() => setCleanerId(null)} onCreate={createDerivative} />}

      {reviewItem && (
        <Modal title="Director review" kicker="SECURE REVIEW VIEW" onClose={() => setReviewId(null)} wide>
          <div className="reviewer-surface">
            <div className="review-media"><ReferenceVisual reference={reviewItem} /><span>{reviewItem.kind}{reviewItem.duration ? ` · ${reviewItem.duration}` : ""}</span></div>
            <div className="review-copy">
              <p className="eyebrow">{reviewItem.film} / {reviewItem.beat}</p><h2>{reviewItem.title}</h2><p>{reviewItem.note}</p>
              <div className="source-line"><span>{reviewItem.provider}</span><a href={reviewItem.url} target="_blank" rel="noreferrer">Open source ↗</a></div>
              <label>Comment<textarea value={reviewComment} onChange={(event) => setReviewComment(event.target.value)} placeholder="What should the designer know?" /></label>
              <div className="decision-grid"><button className="approve-button" onClick={() => decide("Approved")}>✓ Approve</button><button onClick={() => decide("Changes requested")}>↻ Request change</button><button onClick={() => decide("Rejected")}>× Reject</button></div>
            </div>
          </div>
        </Modal>
      )}

      {guideStep !== null && <ProductTour step={guideStep} onStep={(next, view) => { if (view) navigate(view); setGuideStep(next); }} onClose={() => setGuideStep(null)} />}

      {toast && <div className="toast" role="status"><span>✓</span>{toast}</div>}
    </main>
  );
}

function viewTitle(view: View) {
  return ({ Overview: "Project cockpit", Brief: "Creative brief", Search: "Search & capture", References: "Visual library", Review: "Review queue", Approved: "Approved selects", Export: "Final handoff" })[view];
}

function WorkflowBar({ active, counts }: { active: View; counts: { organised: number; total: number } }) {
  const steps = ["Brief", "References", "Review", "Export"];
  const current = Math.max(0, steps.indexOf(active));
  return <div className="progress-strip">
    {steps.map((step, index) => <div className="progress-piece" key={step}><div><span className={`step ${index < current ? "done" : index === current ? "current" : ""}`}>{index < current ? "✓" : index + 1}</span><strong>{step}</strong></div>{index < steps.length - 1 && <i />}</div>)}
    <p><b>{counts.organised}</b> of {counts.total} organised</p>
  </div>;
}

function OverviewView({ project, counts, references, onNavigate }: { project: Project; counts: Record<string, number>; references: Reference[]; onNavigate: (view: View) => void }) {
  const activity = references.slice(0, 4);
  return <div className="overview-view">
    <section className="overview-hero"><div><p className="eyebrow">ACTIVE PROJECT · {project.name.toUpperCase()}</p><h2>From raw links to<br/><em>presentation-ready.</em></h2><p>Your workspace is clean and ready. Add references when you are ready, then organise, review, and export only the selects you approve.</p><button className="primary-button" onClick={() => onNavigate("References")}>{counts.total ? "Continue organising" : "Add your first links"} →</button></div><div className="hero-orbit"><span>{counts.total}</span><p>references captured</p><i className="orbit-one"/><i className="orbit-two"/></div></section>
    <section className="metric-grid"><Metric value={`${counts.organised}/${counts.total}`} label="Organised" meta="Across your project" /><Metric value={String(counts.review)} label="In review" meta="Needs a decision" /><Metric value={String(counts.approved)} label="Approved" meta="Ready for handoff" /><Metric value={String(counts.total)} label="Sources" meta="Captured so far" /></section>
    <div className="overview-columns"><section className="panel"><div className="panel-heading"><div><p className="eyebrow">WORKFLOW</p><h3>Project pulse</h3></div><span className="health-badge">Ready</span></div><div className="pulse-list"><Pulse label="Brief & structure" value={project.brand || project.director ? "Started" : "Not started"} fill={project.brand || project.director ? 35 : 4}/><Pulse label="Reference organisation" value={counts.total ? `${Math.round((counts.organised/counts.total)*100)}%` : "Not started"} fill={counts.total ? (counts.organised/counts.total)*100 : 4}/><Pulse label="Director approvals" value={`${counts.approved} selects`} fill={counts.total ? (counts.approved/counts.total)*100 : 4}/><Pulse label="Final handoff" value="Not started" fill={4}/></div></section><section className="panel"><div className="panel-heading"><div><p className="eyebrow">RECENT</p><h3>Activity</h3></div><button onClick={() => onNavigate("References")}>Open library</button></div>{activity.length ? <div className="activity-list">{activity.map((item, index)=><div key={item.id}><span className={`activity-dot a${index}`}/><p><b>{item.title}</b><small>{item.status} · {item.film}</small></p><time>Now</time></div>)}</div> : <div className="activity-empty"><span>＋</span><b>Nothing here yet</b><p>Add a link or upload media to begin your project history.</p><button onClick={() => onNavigate("References")}>Add references</button></div>}</section></div>
  </div>;
}

function Metric({ value, label, meta }: { value: string; label: string; meta: string }) { return <article className="metric-card"><strong>{value}</strong><div><b>{label}</b><small>{meta}</small></div></article>; }
function Pulse({ label, value, fill }: { label: string; value: string; fill: number }) { return <div className="pulse-row"><div><b>{label}</b><span>{value}</span></div><p><i style={{ width: `${Math.max(4, fill)}%` }} /></p></div>; }
function PlannedButton({ children, title, className }: { children: React.ReactNode; title: string; className?: string }) {
  return <button className={className} disabled title={title} aria-label={`${String(children)}. ${title}`}>{children}</button>;
}

function BriefView({ project, onSearch }: { project: Project; onSearch: () => void }) {
  const sourceMaterialPlan = "Source-material uploads are scheduled for Milestone 2";
  return <div className="brief-view"><div className="brief-main"><section className="brief-cover"><div className="brief-monogram">{project.name.slice(0,1).toUpperCase()}</div><div><p className="eyebrow">NEW PROJECT · {new Date().getFullYear()}</p><h2>{project.name}</h2><p>Add the script, meeting notes, and treatment material you want to keep beside your visual research.</p></div><dl><div><dt>Brand</dt><dd>{project.brand || "Not added"}</dd></div><div><dt>Director</dt><dd>{project.director || "Not added"}</dd></div><div><dt>Designer</dt><dd>{project.designer || "Not added"}</dd></div><div><dt>Due</dt><dd>{project.dueDate ? formatDate(project.dueDate) : "Not set"}</dd></div></dl></section><section className="panel source-panel"><div className="panel-heading"><div><p className="eyebrow">SOURCE MATERIAL</p><h3>Project inputs</h3></div><PlannedButton title={sourceMaterialPlan}>＋ Add material</PlannedButton></div><div className="material-empty"><span>↑</span><b>No source material yet</b><p>Upload a script, brief, transcript, or previous deck when you are ready.</p><PlannedButton title={sourceMaterialPlan}>Choose files</PlannedButton></div></section></div><aside className="brief-side"><section className="panel"><p className="eyebrow">FILM STRUCTURE</p><h3>Build your story</h3><div className="structure-empty"><span>＋</span><p>Create films and story beats as your treatment takes shape.</p><PlannedButton title="Film structure is scheduled for Milestone 2">Add a film</PlannedButton></div></section><section className="panel"><p className="eyebrow">TREATMENT SECTIONS</p><h3>Start from blank</h3><div className="structure-empty"><span>＋</span><p>Add only the sections your project needs.</p><PlannedButton title="Treatment sections are scheduled for Milestone 2">Add a section</PlannedButton></div></section><button className="search-next" onClick={onSearch}><span>Next</span><b>Start visual research</b><i>→</i></button></aside></div>;
}

function SearchView({ references, onCapture, onOpen }: { references: Reference[]; onCapture: () => void; onOpen: (id: string) => void }) {
  const [search, setSearch] = useState("");
  const results = references.filter((item) => !search || `${item.title} ${item.note}`.toLowerCase().includes(search.toLowerCase())).slice(0, 8);
  const providerPlan = "Provider deep links are scheduled for Milestone 4";
  return <div className="search-view" data-tour="search"><section className="search-hero"><p className="eyebrow">CREATIVE DISCOVERY</p><h2>What are you looking for?</h2><p>Search your library or turn a creative thought into focused directions for external reference sources.</p><div className="discovery-input"><span>⌕</span><input value={search} onChange={(event)=>setSearch(event.target.value)} placeholder="Describe a mood, shot, performance, place, or technique"/><button onClick={onCapture}>Paste links</button></div><div className="provider-row"><span>Open in</span>{["Frame Set","Vimeo","YouTube","Pinterest","FilmGrab"].map((provider)=><PlannedButton title={providerPlan} key={provider}>{provider} ↗</PlannedButton>)}</div></section><section className="query-section"><div className="panel-heading"><div><p className="eyebrow">SEARCH DIRECTIONS</p><h3>{search ? "Directions for this idea" : "Start with your own creative thought"}</h3></div>{search&&<PlannedButton title="AI query generation is scheduled after the core project model">Regenerate</PlannedButton>}</div>{search?<div className="query-grid">{["cinematic reference", "camera and framing", "performance and blocking", "colour and light"].map((item,index)=><article key={item}><span>0{index+1}</span><p>{search} · {item}</p><div><button onClick={()=>navigator.clipboard.writeText(`${search} · ${item}`)}>Copy</button><PlannedButton title={providerPlan}>Open search ↗</PlannedButton></div></article>)}</div>:<div className="search-empty"><span>⌕</span><b>No suggested searches yet</b><p>Write what you need above and Pitch it. will turn it into focused search directions.</p></div>}</section><section><div className="panel-heading"><div><p className="eyebrow">YOUR LIBRARY</p><h3>Related references</h3></div><span>{results.length} matches</span></div>{results.length?<div className="search-results">{results.map((item)=><button onClick={()=>onOpen(item.id)} key={item.id}><ReferenceVisual reference={item}/><span>{item.provider}</span><b>{item.title}</b><small>{item.film} · {item.beat}</small></button>)}</div>:<div className="search-empty compact"><b>Your library is empty</b><p>Add links to see related references here.</p><button onClick={onCapture}>Add links</button></div>}</section></div>;
}

function ReferenceVisual({ reference }: { reference: Reference }) {
  return <img src={reference.image || neutralPreview} alt="" />;
}

function ReferencesView({ references, counts, filmFilter, statusFilter, selectedId, onFilm, onStatus, onSelect, onCapture }: { references: Reference[]; counts: Record<string, number>; filmFilter: string; statusFilter: "All"|Status; selectedId: string|null; onFilm:(film:string)=>void; onStatus:(status:"All"|Status)=>void; onSelect:(id:string)=>void; onCapture:()=>void }) {
  const groups = Array.from(new Set(references.map((item) => item.film))).filter(Boolean);
  const filteredByAnything = filmFilter !== "All" || statusFilter !== "All";
  return <div className="references-view" data-tour="library"><div className="library-toolbar"><div className="segmented"><button onClick={()=>onFilm("All")} className={filmFilter==="All"?"selected":""}>All references <b>{counts.total}</b></button>{groups.map((film)=><button onClick={()=>onFilm(film)} className={filmFilter===film?"selected":""} key={film}>{film} <b>{references.filter((item)=>item.film===film).length}</b></button>)}</div><div className="toolbar-actions"><label className="status-select">Status<select value={statusFilter} onChange={(event)=>onStatus(event.target.value as "All"|Status)}><option>All</option>{statuses.map((status)=><option key={status}>{status}</option>)}</select></label><button className="primary-button" data-tour="capture" onClick={onCapture}><b>＋</b> Add links & media</button></div></div>{references.length ? <section className="library-grid"><button className="capture-card" onClick={onCapture}><span>＋</span><h2>Bring in a visual</h2><p>Paste links in bulk or upload authorised media.</p><u>Add references</u></button>{references.map((item)=><ReferenceCard item={item} selected={item.id===selectedId} onSelect={()=>onSelect(item.id)} key={item.id}/>)}</section> : <div className="empty-state empty-library"><span>＋</span><h2>{filteredByAnything ? "No references match" : "Your visual library is empty"}</h2><p>{filteredByAnything ? "Clear the filters to return to your library." : "Paste one link or a whole list. You can organise every item after capture."}</p><button className="primary-button" data-tour="capture-empty" onClick={filteredByAnything ? ()=>{onFilm("All");onStatus("All");} : onCapture}>{filteredByAnything ? "Clear filters" : "Add your first links"}</button></div>}</div>;
}

function ReferenceCard({ item, selected, onSelect }: { item: Reference; selected: boolean; onSelect:()=>void }) {
  return <button className={`reference-card ${selected?"selected":""}`} onClick={onSelect}><div className="reference-image"><ReferenceVisual reference={item}/><span className="frame-number">{item.id.replace(/\D/g,"").slice(-2)}</span><span className="format-pill">{item.kind}{item.duration?` · ${item.duration}`:""}</span><span className="card-menu">•••</span></div><div className="reference-copy"><div className="reference-meta"><span>{item.provider}</span><span className={`status status-${item.status.toLowerCase().replaceAll(" ","-")}`}>{item.status}</span></div><h3>{item.title}</h3><p>{item.note}</p><div className="tag-row"><span>{item.film}</span><span>{item.section}</span></div></div></button>;
}

function Inspector({ reference, onClose, onUpdate, onClean, onReview }: { reference: Reference; onClose:()=>void; onUpdate:(patch:Partial<Reference>)=>void; onClean:()=>void; onReview:()=>void }) {
  return <aside className="inspector"><div className="inspector-head"><div><p className="eyebrow">REFERENCE INSPECTOR</p><b>{reference.title}</b></div><button onClick={onClose} aria-label="Close inspector">×</button></div><div className="inspector-preview"><ReferenceVisual reference={reference}/><span>{reference.kind}{reference.duration?` · ${reference.duration}`:""}</span><a href={reference.url} target="_blank" rel="noreferrer">Open source ↗</a></div><div className="inspector-body"><div className="lineage"><div><span>ORIGINAL</span><b>{reference.provider} source</b><small>{reference.rights}</small></div><i>→</i><div><span>DERIVATIVE</span><b>Preferred v{reference.derivativeVersion}</b><small>{reference.kind} · Current</small></div></div><label>Title<input value={reference.title} onChange={(event)=>onUpdate({title:event.target.value})}/></label><div className="field-pair"><label>Film or group<input value={reference.film} onChange={(event)=>onUpdate({film:event.target.value})}/></label><label>Section<input value={reference.section} onChange={(event)=>onUpdate({section:event.target.value})}/></label></div><label>Story beat<input value={reference.beat} onChange={(event)=>onUpdate({beat:event.target.value})}/></label><label>Intended role<select value={reference.role} onChange={(event)=>onUpdate({role:event.target.value})}>{["Mood / world","Action / shot","Character / performance","Product","Layout"].map((item)=><option key={item}>{item}</option>)}</select></label><label>Creative note<textarea value={reference.note} onChange={(event)=>onUpdate({note:event.target.value})}/></label><div className="rights-row"><div><span>Rights</span><b>{reference.rights}</b></div><PlannedButton title="Rights editing is scheduled for Milestone 2">Update</PlannedButton></div><div className="inspector-tags"><p>LABELS <PlannedButton title="Label management is scheduled for Milestone 2">＋</PlannedButton></p><div><span>{reference.film}</span><span>{reference.section}</span><span>{reference.role}</span></div></div></div><div className="inspector-actions"><button className="quiet-button" onClick={onClean}>Preview asset recipe</button><button className="primary-button" onClick={onReview}>Send for review</button></div></aside>;
}

function ReviewView({ references, onReview, onOpen }: { references: Reference[]; onReview:(id:string)=>void; onOpen:(id:string)=>void }) {
  const [tab,setTab]=useState<"Awaiting review"|"Changes requested"|"Decided">("Awaiting review");
  const queue = references.filter((item)=> tab === "Awaiting review" ? item.status === "Ready for review" : tab === "Changes requested" ? item.status === "Changes requested" : ["Approved","Rejected","Exported"].includes(item.status));
  const groups=Array.from(new Set(references.map((item)=>item.film)).values()).filter(Boolean);
  return <div className="review-view"><div className="review-summary"><div><span>{references.filter((item)=>item.status==="Ready for review").length}</span><p><b>Awaiting a decision</b><small>Ready for review</small></p></div><div><span>{references.filter((item)=>item.status==="Changes requested").length}</span><p><b>Changes requested</b><small>Resolve and resubmit</small></p></div><div><span>{references.filter((item)=>["Approved","Exported"].includes(item.status)).length}</span><p><b>Approved</b><small>Current derivative versions</small></p></div><PlannedButton title="Private review links are scheduled for Milestone 3">＋ New review request</PlannedButton></div><div className="review-tabs">{(["Awaiting review","Changes requested","Decided"] as const).map((item)=><button className={tab===item?"active":""} onClick={()=>setTab(item)} key={item}>{item}</button>)}</div><section className="review-table"><header><span>Reference</span><span>Context</span><span>Version</span><span>Status</span><span>Action</span></header>{queue.map((item)=><article key={item.id}><button className="review-reference" onClick={()=>onOpen(item.id)}><img src={item.image} alt=""/><p><b>{item.title}</b><small>{item.provider} · {item.kind}</small></p></button><p><b>{item.film}</b><small>{item.beat}</small></p><span>v{item.derivativeVersion}</span><span className={`status status-${item.status.toLowerCase().replaceAll(" ","-")}`}>{item.status}</span><button className="review-action" onClick={()=>onReview(item.id)}>{tab==="Awaiting review"?"Open review":"View decision"}</button></article>)}{!queue.length&&<div className="table-empty"><span>✓</span><b>This queue is clear</b><p>Items will appear after you send references for review.</p></div>}</section>{groups.length>0&&<section className="collection-strip"><div className="panel-heading"><div><p className="eyebrow">GROUPS</p><h3>Review as a story</h3></div></div><div>{groups.map((group)=><CollectionCard key={group} title={group} count={references.filter((item)=>item.film===group).length} images={references.filter((item)=>item.film===group).slice(0,4).map((item)=>item.image)}/>)}</div></section>}</div>;
}

function CollectionCard({ title, count, images: thumbs }: { title:string; count:number; images:string[] }) { return <article className="collection-card"><div>{thumbs.map((image,index)=><img src={image} alt="" key={image+index}/>)}</div><p><b>{title}</b><small>{count} references · Ready for review</small></p><PlannedButton title="Ordered collection reviews are scheduled for Milestone 3">Open →</PlannedButton></article>; }

function ApprovedView({ references, onOpen, onExport }: { references:Reference[]; onOpen:(id:string)=>void; onExport:()=>void }) {
  const approved=references.filter((item)=>["Approved","Exported"].includes(item.status));
  const groups = Array.from(new Set(approved.map((item)=>item.film))).filter(Boolean);
  return <div className="approved-view"><section className="approved-hero"><div><p className="eyebrow">CURRENT APPROVED VERSIONS</p><h2>{approved.length} presentation-ready selects</h2><p>Every asset below is tied to its source, reviewed derivative version, and creative context.</p></div><button className="primary-button" disabled={!approved.length} onClick={onExport}>Prepare final handoff →</button></section><div className="approved-groups">{groups.map((film)=><section key={film}><div className="panel-heading"><div><p className="eyebrow">GROUP</p><h3>{film}</h3></div><span>{approved.filter((item)=>item.film===film).length} approved</span></div><div className="approved-grid">{approved.filter((item)=>item.film===film).map((item)=><button key={item.id} onClick={()=>onOpen(item.id)}><div><img src={item.image} alt=""/><span>✓</span></div><b>{item.title}</b><small>{item.beat} · v{item.derivativeVersion}</small></button>)}</div></section>)}{!approved.length&&<div className="approved-empty approved-empty-page"><span>✓</span><h3>No approved selects yet</h3><p>Items you approve in Review will collect here automatically.</p></div>}</div></div>;
}

function ExportView({ project, references, exported, onExport, onManifest }: { project:Project; references:Reference[]; exported:boolean; onExport:()=>void; onManifest:()=>void }) {
  const approved=references.filter((item)=>["Approved","Exported"].includes(item.status)); const linkOnly=approved.filter((item)=>item.rights==="Link only").length;
  const groups=Array.from(new Set(approved.map((item)=>item.film))).filter(Boolean);
  // Folder uses React's conventional children prop for its list of story-beat names.
  // eslint-disable-next-line react/no-children-prop
  return <div className="export-view"><div className="export-columns"><section className="export-main"><div className="export-intro"><p className="eyebrow">FINAL HANDOFF</p><h2>{project.name} / Approved</h2><p>Prepare a local provenance manifest now. Google Drive export arrives in Milestone 5.</p></div><div className="destination-card"><div className="drive-mark">D</div><div><span>DESTINATION</span><b>{project.name} / Approved_References</b><small>Google Drive connection is not enabled in this localhost build</small></div><PlannedButton title="Google Drive selection is scheduled for Milestone 5">Choose</PlannedButton></div><section className="panel folder-preview"><div className="panel-heading"><div><p className="eyebrow">FOLDER PREVIEW</p><h3>What will be created</h3></div><span>{approved.length} files</span></div><div className="folder-tree">{groups.map((group,index)=><Folder key={group} name={`${String(index+1).padStart(2,"0")}_${group.replace(/[^a-z0-9]+/gi,"_")}`} count={approved.filter((item)=>item.film===group).length} children={Array.from(new Set(approved.filter((item)=>item.film===group).map((item)=>item.beat))).filter(Boolean)}/>)}{!groups.length&&<div className="folder-empty">Approved groups will appear here.</div>}<div className="manifest-files"><span>J</span><p><b>manifest.json</b><small>Full source lineage and metadata</small></p></div><div className="manifest-files"><span>C</span><p><b>manifest.csv</b><small>Spreadsheet-ready asset index</small></p></div></div></section></section><aside className="export-side"><section className="panel validation-panel"><p className="eyebrow">VALIDATION</p><h3>{exported?"Manifest ready":approved.length?"Ready to prepare":"Waiting for approvals"}</h3><div className="validation-score"><span>{exported?"✓":approved.length}</span><p>{exported?"local batch prepared":"approved files"}</p></div><ul><li className={approved.length?"ok":"warn"}><span>{approved.length?"✓":"!"}</span>Current approved versions</li><li className={approved.length?"ok":"warn"}><span>{approved.length?"✓":"!"}</span>Source URLs present</li><li className="ok"><span>✓</span>No exact duplicates</li><li className={linkOnly?"warn":"ok"}><span>{linkOnly?"!":"✓"}</span>{linkOnly} link-only references excluded</li><li className={approved.length?"ok":"warn"}><span>{approved.length?"✓":"!"}</span>Manifest ready</li></ul></section><div className="export-total"><span>ESTIMATED HANDOFF</span><b>{approved.length ? Math.max(12,approved.length*12) : 0} MB</b><small>{approved.length} assets · 2 manifests</small></div>{exported?<><button className="primary-button export-button" onClick={onManifest}>Download manifest</button><p className="export-note">This is a local JSON manifest; no files have been sent to Drive.</p></>:<><button disabled={!approved.length} className="primary-button export-button" onClick={onExport}>Prepare local manifest →</button><p className="export-note">Only current approved derivative records will be included.</p></>}</aside></div></div>;
}

function Folder({ name, count, children }: { name:string; count:number; children:string[] }) { return <div className="folder"><div><span>⌄</span><b>{name}</b><small>{count} files</small></div>{children.map((child)=><p key={child}><span>□</span>{child}</p>)}</div>; }

function Cleaner({ reference, onClose, onCreate }: { reference:Reference; onClose:()=>void; onCreate:()=>void }) {
  const [start,setStart]=useState(18); const [end,setEnd]=useState(62); const [format,setFormat]=useState("GIF");
  return <div className="cleaner-overlay"><header><div className="wordmark">Pitch it.</div><div><p className="eyebrow">RECIPE PREVIEW / {reference.film.toUpperCase()}</p><b>{reference.title}</b></div><button onClick={onClose}>Close ×</button></header><main><section className="cleaner-stage"><div className="cleaner-preview"><img src={reference.image} alt=""/><PlannedButton className="play-button" title="Video playback is scheduled for Milestone 6">▶</PlannedButton><span>00:03.2</span></div><div className="timeline"><div className="frame-strip">{Array.from({length:9}).map((_,index)=><img src={reference.image} style={{objectPosition:`${index*12}% center`}} alt="" key={index}/>)}</div><div className="range-track"><i style={{left:`${start}%`,right:`${100-end}%`}}/><input aria-label="In point" type="range" value={start} onChange={(event)=>setStart(Number(event.target.value))}/><input aria-label="Out point" type="range" value={end} onChange={(event)=>setEnd(Number(event.target.value))}/></div><div className="timecodes"><span>IN <b>00:02.1</b></span><span>Selection <b>4.0 sec</b></span><span>OUT <b>00:06.1</b></span></div></div><div className="cleaner-lineage"><p><span>ORIGINAL</span><b>{reference.provider} source</b><small>Preview metadata only</small></p><i>→</i><p><span>PROPOSED DERIVATIVE</span><b>{reference.title}-v{reference.derivativeVersion+1}</b><small>Not created in this build</small></p></div></section><aside className="cleaner-controls"><p className="eyebrow">OUTPUT RECIPE · PREVIEW ONLY</p><h2>Plan a derivative</h2><label>Format<div className="format-options">{["GIF","Still","MP4"].map((item)=><button onClick={()=>setFormat(item)} className={format===item?"active":""} key={item}>{item}</button>)}</div></label><label>Aspect ratio<select><option>16:9 — Presentation</option><option>4:3 — Classic</option><option>1:1 — Square</option><option>Original</option></select></label><div className="field-pair"><label>Width<select><option>960 px</option><option>1280 px</option><option>1920 px</option></select></label><label>FPS<select><option>15 fps</option><option>20 fps</option><option>24 fps</option></select></label></div><label>Quality<input type="range" defaultValue="72"/><div className="range-label"><span>Smaller</span><span>Sharper</span></div></label><label>Derivative label<input defaultValue={reference.title.toLowerCase().replaceAll(" ","-")}/></label><div className="estimate"><p><span>Estimated size</span><b>Preview</b></p><p><span>Processing</span><b>Not connected</b></p><p><span>Rights</span><b>{reference.rights}</b></p></div><button className="primary-button create-output" onClick={onCreate} disabled title="Real media processing is scheduled for Milestone 6">Create {format} derivative →</button><small className="guardrail">Preview only. No media file will be created or overwritten.</small></aside></main></div>;
}

function Modal({ title, kicker, onClose, wide=false, children }: { title:string; kicker:string; onClose:()=>void; wide?:boolean; children:React.ReactNode }) { return <div className="modal-backdrop" role="presentation" onMouseDown={(event)=>{if(event.target===event.currentTarget)onClose();}}><section className={`modal ${wide?"modal-wide":""}`}><header><div><p className="eyebrow">{kicker}</p><h2>{title}</h2></div><button onClick={onClose} aria-label="Close">×</button></header>{children}</section></div>; }

function formatDate(value: string) {
  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat("en", { day: "numeric", month: "short" }).format(date);
}

function PublicHome({ onEnter }: { onEnter: () => void }) {
  return <main className="public-home">
    <header className="home-nav">
      <a className="wordmark" href="#top" aria-label="Pitch it. home">Pitch it.</a>
      <nav aria-label="Homepage navigation"><a href="#workflow">How it works</a><a href="#principles">Why Pitch it.</a></nav>
      <button onClick={onEnter}>Explore workspace <span>→</span></button>
    </header>

    <section className="home-hero" id="top">
      <div className="home-hero-copy">
        <p className="eyebrow">THE VISUAL TREATMENT WORKSPACE</p>
        <h1>References,<br/><em>ready to pitch.</em></h1>
        <p className="home-lede">Pitch it. brings visual research, creative context, feedback, and approved selects into one focused workflow—built for treatment designers.</p>
        <div className="home-actions"><button className="home-primary" onClick={onEnter}>Explore the workspace <span>→</span></button><a href="#workflow">See the workflow <span>↓</span></a></div>
        <ul><li>Capture with context</li><li>Review exact versions</li><li>Handoff with traceability</li></ul>
      </div>

      <div className="home-product" aria-label="Preview of the Pitch it. project workspace">
        <div className="home-product-bar"><b>Pitch it.</b><span>PILOT PREVIEW</span><i>● Saved</i></div>
        <div className="home-product-shell">
          <aside><span className="selected">01</span><span>02</span><span>03</span><span>04</span><span>05</span></aside>
          <div className="home-product-main">
            <header><div><small>PROJECT / OVERVIEW</small><b>Project cockpit</b></div><span>⌕ Search</span></header>
            <section className="home-preview-hero"><div><small>ACTIVE PROJECT</small><strong>From raw links to<br/>presentation-ready.</strong><p>One clear path from discovery to handoff.</p></div><div><b>24</b><small>references</small></div></section>
            <div className="home-preview-metrics"><span><b>18</b><small>Organised</small></span><span><b>6</b><small>In review</small></span><span><b>9</b><small>Approved</small></span></div>
            <div className="home-preview-board"><span/><span/><span/></div>
          </div>
        </div>
      </div>
    </section>

    <section className="home-marquee" aria-label="Pitch it. workflow summary"><span>FIND THE FRAME</span><i>●</i><span>SHAPE THE STORY</span><i>●</i><span>MAKE THE DECISION</span><i>●</i><span>HAND OFF CLEANLY</span></section>

    <section className="home-workflow" id="workflow">
      <div className="home-section-heading"><p className="eyebrow">ONE CONTINUOUS WORKFLOW</p><h2>Less tab chaos.<br/>More treatment thinking.</h2><p>Keep the visual idea attached to its source, purpose, feedback, and final decision from the moment you find it.</p></div>
      <div className="home-workflow-grid">
        <article><span>01</span><div className="home-step-mark">⌕</div><h3>Discover</h3><p>Search your library, open specialist sources, and collect the frames that move the treatment forward.</p></article>
        <article><span>02</span><div className="home-step-mark">＋</div><h3>Shape</h3><p>Organise each reference by film, story beat, section, intended role, and the creative note that matters.</p></article>
        <article><span>03</span><div className="home-step-mark">✓</div><h3>Decide</h3><p>Review exact versions, capture comments, and keep approvals separate from work that still needs a change.</p></article>
        <article><span>04</span><div className="home-step-mark">↗</div><h3>Handoff</h3><p>Collect only approved work and carry its source lineage into a clean, presentation-ready package.</p></article>
      </div>
    </section>

    <section className="home-principles" id="principles">
      <div><p className="eyebrow">DESIGNED AROUND THE WORK</p><h2>Creative instinct,<br/><em>with operational clarity.</em></h2></div>
      <div className="home-principle-list">
        <article><span>01</span><p><b>The idea stays visible.</b><small>References remain connected to the thought, scene, or story beat that made them useful.</small></p></article>
        <article><span>02</span><p><b>Originals stay traceable.</b><small>Source, rights context, and derivative versions travel with every select.</small></p></article>
        <article><span>03</span><p><b>Approval means one thing.</b><small>Only the exact decided version reaches the approved library and final handoff.</small></p></article>
      </div>
    </section>

    <section className="home-cta"><p className="eyebrow">PITCH IT. PILOT</p><h2>Find the frame.<br/><em>Shape the pitch.</em></h2><p>Step into the public product preview and see how a treatment project moves from a blank workspace to approved selects.</p><button onClick={onEnter}>Explore the workspace <span>→</span></button><small>Public preview · no account required · real project storage is disabled</small></section>

    <footer className="home-footer"><div className="wordmark">Pitch it.</div><p>A visual treatment workspace for creative teams.</p><a href="#top">Back to top ↑</a></footer>
  </main>;
}

function ProjectLauncher({ onCreate, onHome }: { onCreate: () => void; onHome: () => void }) {
  return <main className="project-launcher"><header><div className="launcher-brand"><button className="wordmark launcher-wordmark-button" onClick={onHome} aria-label="Return to the Pitch it. homepage">Pitch it.</button><span className="build-badge">PILOT PREVIEW</span></div><button className="launcher-help" onClick={onCreate}>? Create to start guide</button></header><section><div className="launcher-copy"><p className="eyebrow">THE TREATMENT WORKSPACE · PUBLIC PREVIEW</p><h1>Find the frame.<br/><em>Shape the pitch.</em></h1><p>Create a blank treatment workspace, gather visual references, and move every select through a clear creative review to a traceable final handoff.</p><button className="launcher-create" onClick={onCreate}><span>＋</span><b>Create new project</b><small>Start with a clean preview workspace</small><i>→</i></button><small className="launcher-note">A guided tour starts automatically after creation. Preview projects reset when the page reloads.</small></div><div className="launcher-steps"><article><span>01</span><div><b>Create</b><p>Name the project and add only the context you know.</p></div></article><article><span>02</span><div><b>Capture</b><p>Paste one link or an entire research list.</p></div></article><article><span>03</span><div><b>Shape</b><p>Organise, preview recipes, review, and approve your references.</p></div></article><article><span>04</span><div><b>Handoff</b><p>Download a preview manifest; Drive export follows in a later milestone.</p></div></article></div></section><footer><span>Public product preview</span><span>Originals stay intact</span><span>Real project storage disabled</span></footer></main>;
}

type ProjectDraft = { name: string; brand: string; director: string; designer: string; dueDate: string };

function ProjectModal({ draft, onDraft, onClose, onCreate, replacing=false }: { draft: ProjectDraft; onDraft: (draft: ProjectDraft) => void; onClose: () => void; onCreate: () => void; replacing?: boolean }) {
  return <Modal title="Create a new project" kicker="START FROM BLANK" onClose={onClose}>
    <div className="project-form">
      {replacing&&<div className="replace-warning"><span>!</span><p><b>Start a fresh active workspace</b><small>Your current project data will be replaced when you create this one.</small></p></div>}
      <label>Project name *<input value={draft.name} onChange={(event)=>onDraft({...draft,name:event.target.value})} placeholder="e.g. Brand treatment or film title" /></label>
      <div className="field-pair"><label>Brand<input value={draft.brand} onChange={(event)=>onDraft({...draft,brand:event.target.value})} placeholder="Optional" /></label><label>Due date<input type="date" value={draft.dueDate} onChange={(event)=>onDraft({...draft,dueDate:event.target.value})} /></label></div>
      <div className="field-pair"><label>Director<input value={draft.director} onChange={(event)=>onDraft({...draft,director:event.target.value})} placeholder="Optional" /></label><label>Designer<input value={draft.designer} onChange={(event)=>onDraft({...draft,designer:event.target.value})} placeholder="Optional" /></label></div>
      <div className="blank-promise"><span>✓</span><p><b>No demo content will be added.</b><small>Your project opens with an empty brief, library, review queue, and export.</small></p></div>
    </div>
    <div className="modal-actions"><button className="quiet-button" onClick={onClose}>Cancel</button><button className="primary-button" onClick={onCreate}>Create blank project →</button></div>
  </Modal>;
}

const tourSteps: { selector: string; view?: View; kicker: string; title: string; body: string }[] = [
  { selector: '[data-tour="navigation"]', kicker: "YOUR WORKFLOW", title: "Move through the project", body: "Brief holds context, Search helps discovery, References is your working library, then Review, Approved, and Export complete the handoff." },
  { selector: '[data-nav="Brief"]', view: "Brief", kicker: "STEP 1", title: "Begin with context", body: "Add your script, notes, project structure, and treatment sections here. Nothing is pre-filled for you." },
  { selector: '[data-tour="search"]', view: "Search", kicker: "STEP 2", title: "Describe what you need", body: "Turn a visual idea into focused search directions, or jump to an external source and capture the links you choose." },
  { selector: '[data-tour="capture"], [data-tour="capture-empty"]', view: "References", kicker: "STEP 3", title: "Add links and media", body: "Paste one URL or a whole list. Pitch it. detects sources and keeps each item in your inbox for you to label." },
  { selector: '[data-nav="Review"]', view: "Review", kicker: "STEP 4", title: "Make decisions explicit", body: "Send ready references for review, approve exact versions, and keep every comment or change request in one queue." },
  { selector: '[data-nav="Export"]', view: "Export", kicker: "STEP 5", title: "Handoff only approved work", body: "Export creates a clean folder and provenance manifest using only current approved derivative versions." },
  { selector: '[data-tour="help"]', kicker: "YOU ARE READY", title: "Replay this guide anytime", body: "Use the Guide button whenever you want a refresher. Your project saves automatically as you work." },
];

function ProductTour({ step, onStep, onClose }: { step: number; onStep: (step: number, view?: View) => void; onClose: () => void }) {
  const [rect, setRect] = useState<DOMRect | null>(null);
  const item = tourSteps[step];
  useEffect(() => {
    const measure = () => {
      const target = document.querySelector(item.selector);
      setRect(target?.getBoundingClientRect() ?? null);
    };
    const timer = window.setTimeout(measure, 80);
    window.addEventListener("resize", measure);
    return () => { window.clearTimeout(timer); window.removeEventListener("resize", measure); };
  }, [item.selector]);
  const width = rect?.width ?? 120;
  const height = rect?.height ?? 44;
  const focusStyle = rect ? { left: Math.max(4,rect.left-5), top: Math.max(4,rect.top-5), width: width+10, height: height+10 } : undefined;
  const tooltipLeft = rect ? Math.min(window.innerWidth-326, Math.max(16, rect.right+16 > window.innerWidth-320 ? rect.left-326 : rect.right+16)) : 24;
  const tooltipTop = rect ? Math.min(window.innerHeight-250, Math.max(16, rect.top+Math.min(28,rect.height/3))) : 24;
  const last = step === tourSteps.length-1;
  return <div className="tour-layer"><div className="tour-focus" style={focusStyle}/><section className="tour-tooltip" style={{left:tooltipLeft,top:tooltipTop}} role="dialog" aria-label="Pitch it. guide"><div className="tour-progress"><span>{item.kicker}</span><i>{step+1} / {tourSteps.length}</i></div><h2>{item.title}</h2><p>{item.body}</p><div><button onClick={onClose}>Skip tour</button><button className="primary-button" onClick={()=>last?onClose():onStep(step+1,tourSteps[step+1].view)}>{last?"Finish":"Next"} →</button></div></section></div>;
}
