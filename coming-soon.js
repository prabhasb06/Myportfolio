const previews = {
  rag: {
    index: "02 / FIELD NOTE",
    phase: "PUBLIC PREVIEW IN PREPARATION",
    name: "RAG-BASED AI ASSISTANT",
    title: "Answers with",
    accent: "their evidence.",
    lead: "An offline retrieval assistant that traces agriculture-handbook answers back to their source pages. The local system exists; its public experience is being prepared.",
    state: "Local handbook retrieval and page-level citations exist. A live public experience is still ahead.",
    code: "RAG / 02",
    steps: [
      ["SOURCE MATERIAL", "Local agriculture handbooks provide the material the assistant can actually cite."],
      ["RETRIEVAL", "BM25-style ranking finds relevant passages without relying on a remote service."],
      ["EVIDENCE", "Page references let the reader trace an answer back to its source."]
    ]
  },
  slm: {
    index: "05 / FIELD NOTE",
    phase: "TRAINING PIPELINE / IN DEVELOPMENT",
    name: "SMALL LANGUAGE MODEL",
    title: "Learning from",
    accent: "first principles.",
    lead: "An educational decoder-only language model with 97.5 million parameters, built from random initialization. Architecture, a byte-level BPE tokenizer, and checkpointed training workflows are implemented; a useful trained model is the next challenge.",
    state: "Training smoke workflows have been exercised. A substantively pretrained, evaluated model is not yet presented as available.",
    code: "SLM / 05",
    steps: [
      ["ARCHITECTURE", "Twelve decoder blocks with RoPE, RMSNorm, and SwiGLU; 97,536,768 trainable parameters in the default configuration."],
      ["PIPELINE", "A byte-level BPE tokenizer, streamed data, mixed precision, checkpoint/resume, and instruction-tuning workflows establish the route to training."],
      ["NEXT MILESTONE", "Meaningful pretraining and evaluation will determine what the model can really do."]
    ]
  },
  business: {
    index: "06 / FUTURE NOTE",
    phase: "FUTURE DIRECTION",
    name: "BUSINESS OPERATOR",
    title: "An operator that",
    accent: "shows its work.",
    lead: "A future direction for an evidence-led business agent: observing operating context, forming reviewable proposals, and leaving consequential decisions with people. This is an early concept, not a released product.",
    state: "Exploration and prototype thinking are underway. There is no live product yet.",
    code: "OPS / 06",
    steps: [
      ["OBSERVE", "Bring relevant operating signals into a clear working context."],
      ["REASON", "Turn those signals into proposals with visible evidence and assumptions."],
      ["APPROVE", "Keep consequential action subject to human review and control."]
    ]
  }
};

const requestedProject = document.body.dataset.project || new URLSearchParams(window.location.search).get("project");
const projectKey = Object.hasOwn(previews, requestedProject) ? requestedProject : "rag";
const project = previews[projectKey];
document.body.dataset.project = projectKey;
document.title = `${project.name.replaceAll("-", " ")} — In the Making | Prabhas Bangarugari`;
document.querySelector('meta[name="description"]').content=project.lead;
document.querySelector('meta[property="og:title"]').content=document.title;
document.querySelector('meta[property="og:description"]').content=project.lead;

document.getElementById("project-index").textContent = project.index;
document.getElementById("project-phase").textContent = project.phase;
document.getElementById("project-name").textContent = project.name;
document.getElementById("preview-title").replaceChildren(project.title, document.createElement("br"), Object.assign(document.createElement("em"), { textContent: project.accent }));
document.getElementById("project-lead").textContent = project.lead;
document.getElementById("project-state").textContent = project.state;
document.getElementById("visual-code").textContent = project.code;

const stepHost = document.getElementById("project-steps");
stepHost.replaceChildren();
const stepIndex = document.getElementById("active-step-index");
const stepTitle = document.getElementById("active-step-title");
const stepDetail = document.getElementById("active-step-detail");

function selectStep(index) {
  const [title, detail] = project.steps[index];
  stepIndex.textContent = `${String(index + 1).padStart(2, "0")} / 03`;
  stepTitle.textContent = title;
  stepDetail.textContent = detail;
  stepHost.querySelectorAll("button").forEach((button, buttonIndex) => {
    button.setAttribute("aria-pressed", String(buttonIndex === index));
  });
  document.querySelector(".preview-console").dataset.stage=String(index+1);
}

project.steps.forEach(([title], index) => {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "preview-console__phase";
  button.setAttribute("aria-controls","stage-readout");
  button.innerHTML = `<span>${String(index + 1).padStart(2, "0")}</span><strong></strong><span aria-hidden="true">↗</span>`;
  button.querySelector("strong").textContent = title;
  button.addEventListener("click", () => selectStep(index));
  stepHost.append(button);
});
selectStep(0);
document.querySelectorAll(".preview-project-nav a").forEach(link=>{
  if(link.getAttribute("href")===`preview-${projectKey}.html`) link.setAttribute("aria-current","page");
});
