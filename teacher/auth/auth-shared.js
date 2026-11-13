"use strict";

// Fictional, approved schools for the frontend demo only. Replace with approved
// schools and ID rules from the backend; matching a rule does not verify identity.
const LearningBridgeAuth = (() => {
  const schools = Object.freeze([
    { id: "demo-a", name: "Demo School A", status: "approved", pattern: /^\d{8}$/, example: "26560053", rule: "Exactly 8 digits", error: "Teacher ID must contain exactly 8 digits." },
    { id: "demo-b", name: "Demo School B", status: "approved", pattern: /^GV\d{8}$/, example: "GV20260053", rule: "GV followed by 8 digits", error: "Teacher ID must start with GV followed by 8 digits." },
    { id: "demo-c", name: "Demo School C", status: "approved", pattern: /^T\d{4}-\d{3}$/, example: "T2026-015", rule: "T + 4 digits + hyphen + 3 digits", error: "Expected format: T2026-015 (T + 4 digits + hyphen + 3 digits)." }
  ]);

  const validators = {
    name: value => {
      const name = value.trim();
      if (!name) return "Enter your full name.";
      return name.length >= 2 && name.length <= 100 && /^\p{L}[\p{L}\p{M}\s.'’\-]*$/u.test(name)
        ? "" : "Enter a name of 2–100 characters using letters, spaces, apostrophes, periods or hyphens.";
    },
    username: value => /^[A-Za-z0-9][A-Za-z0-9_.]{2,29}$/.test(value)
      ? "" : "Use 3–30 letters, numbers, underscores or dots, starting with a letter or number.",
    password: (value, register) => !value ? "Enter your password." : register && value.length < 8 ? "Use at least 8 characters for your password." : "",
    teacherId: (value, school) => !school ? "Select your school before checking your Teacher ID." : !value ? "Enter the Teacher ID issued by your school." : school.pattern.test(value) ? "" : school.error
  };

  function init({ mode }) {
    const register = mode === "register";
    const form = document.getElementById("auth-form");
    const get = id => document.getElementById(id);
    const schoolInput = get("school");
    const list = get("school-options");
    const status = get("form-status");
    const touched = new Set();
    let selectedSchool = null;
    let visibleSchools = [];
    let activeOption = -1;
    const isSchool = () => form.elements["account-type"].value === "school";

    function clearStatus() { status.hidden = true; status.textContent = ""; }
    function notify(message) {
      status.textContent = message;
      status.hidden = false;
      status.focus();
    }
    function setError(id, message) {
      get(`${id}-error`).textContent = message;
      get(id).setAttribute("aria-invalid", String(Boolean(message)));
      return !message;
    }
    function validate(id) {
      const value = get(id).value;
      let error = "";
      switch (id) {
        case "full-name": error = validators.name(value); break;
        case "school": error = selectedSchool ? "" : "Select a school from the approved demo list."; break;
        case "teacher-id": error = validators.teacherId(value, selectedSchool); break;
        case "username": error = validators.username(value); break;
        case "password": error = validators.password(value, register); break;
        case "confirm-password": error = !value ? "Confirm your password." : value !== get("password").value ? "Passwords do not match." : ""; break;
      }
      return setError(id, error);
    }
    function activeFields() {
      return [...(register ? ["full-name"] : []), ...(isSchool() ? ["school", "teacher-id"] : ["username"]), "password", ...(register ? ["confirm-password"] : [])];
    }
    function updateHint() {
      get("teacher-id-hint").textContent = selectedSchool
        ? `${selectedSchool.rule}. Example: ${selectedSchool.example}. Format check only; this does not verify your identity.`
        : "Select a school to see its Teacher ID format.";
    }
    function closeList() {
      list.hidden = true;
      schoolInput.setAttribute("aria-expanded", "false");
      schoolInput.removeAttribute("aria-activedescendant");
      activeOption = -1;
    }
    function highlight(index) {
      activeOption = index;
      [...list.children].forEach((option, i) => option.setAttribute("aria-selected", String(i === index)));
      if (index >= 0) {
        schoolInput.setAttribute("aria-activedescendant", `school-option-${index}`);
        list.children[index].scrollIntoView({ block: "nearest" });
      }
    }
    function chooseSchool(school) {
      selectedSchool = school;
      schoolInput.value = school.name;
      touched.add("school");
      updateHint();
      validate("school");
      if (touched.has("teacher-id")) validate("teacher-id");
      clearStatus();
      closeList();
      schoolInput.focus();
    }
    function openList() {
      const query = selectedSchool && schoolInput.value === selectedSchool.name ? "" : schoolInput.value.trim().toLowerCase();
      visibleSchools = schools.filter(school => school.status === "approved" && school.name.toLowerCase().includes(query));
      list.replaceChildren();
      visibleSchools.forEach((school, i) => {
        const option = document.createElement("li");
        option.id = `school-option-${i}`;
        option.setAttribute("role", "option");
        option.setAttribute("aria-selected", "false");
        option.textContent = school.name;
        option.addEventListener("mousedown", event => event.preventDefault());
        option.addEventListener("click", () => chooseSchool(school));
        list.append(option);
      });
      if (!visibleSchools.length) {
        const empty = document.createElement("li");
        empty.setAttribute("role", "option");
        empty.setAttribute("aria-disabled", "true");
        empty.textContent = "No approved demo schools found.";
        list.append(empty);
      }
      activeOption = -1;
      schoolInput.removeAttribute("aria-activedescendant");
      list.hidden = false;
      schoolInput.setAttribute("aria-expanded", "true");
    }
    schoolInput.addEventListener("focus", openList);
    schoolInput.addEventListener("click", openList);
    schoolInput.addEventListener("input", () => {
      selectedSchool = null;
      updateHint();
      openList();
      if (touched.has("teacher-id")) validate("teacher-id");
    });
    schoolInput.addEventListener("blur", closeList);
    schoolInput.addEventListener("keydown", event => {
      if (event.key === "Escape") { closeList(); return; }
      if (event.key === "Tab") { closeList(); return; }
      if (event.key === "ArrowDown" || event.key === "ArrowUp") {
        event.preventDefault();
        if (list.hidden) openList();
        if (visibleSchools.length) highlight((activeOption + (event.key === "ArrowDown" ? 1 : -1) + visibleSchools.length) % visibleSchools.length);
      }
      if (event.key === "Enter" && !list.hidden) {
        event.preventDefault();
        if (activeOption >= 0) chooseSchool(visibleSchools[activeOption]);
      }
    });

    function updateAccountType() {
      const schoolAccount = isSchool();
      get("school-fields").hidden = !schoolAccount;
      get("independent-fields").hidden = schoolAccount;
      ["school", "teacher-id"].forEach(id => { get(id).disabled = !schoolAccount; get(id).required = schoolAccount; });
      get("username").disabled = schoolAccount;
      get("username").required = !schoolAccount;
      ["school", "teacher-id", "username"].forEach(id => { setError(id, ""); touched.delete(id); });
      get("verification-note").textContent = schoolAccount
        ? register
          ? "After backend registration, school accounts start unverified. Drafts can be edited; publishing under a school requires school verification."
          : "This demo checks input format only. Account authentication and school verification require backend integration."
        : "Independent teachers use a Learning Bridge username. No school affiliation is required. This frontend demo does not create or authenticate accounts.";
      closeList();
      clearStatus();
    }
    form.querySelectorAll('[name="account-type"]').forEach(radio => radio.addEventListener("change", updateAccountType));
    form.querySelectorAll('.field input').forEach(input => {
      input.addEventListener("blur", () => { if (!input.disabled) { touched.add(input.id); validate(input.id); } });
      input.addEventListener("input", () => {
        clearStatus();
        if (touched.has(input.id)) validate(input.id);
        if (register && input.id === "password" && touched.has("confirm-password")) validate("confirm-password");
      });
    });
    form.querySelectorAll('[data-password]').forEach(button => {
      button.addEventListener("click", () => {
        const input = get(button.dataset.password);
        const show = input.type === "password";
        input.type = show ? "text" : "password";
        button.textContent = show ? "Hide" : "Show";
        button.setAttribute("aria-pressed", String(show));
        button.setAttribute("aria-label", `${show ? "Hide" : "Show"} ${input.id === "confirm-password" ? "confirm password" : "password"}`);
      });
    });
    if (!register) get("forgot-password").addEventListener("click", () => notify("Password recovery is not available in this frontend demo."));
    form.addEventListener("submit", event => {
      event.preventDefault();
      closeList();
      clearStatus();
      const invalid = activeFields().filter(id => { touched.add(id); return !validate(id); });
      if (invalid.length) { get(invalid[0]).focus(); return; }
      notify(register
        ? "Form validated. Account registration will be available after backend integration."
        : "Login form validated. Authentication requires backend integration.");
    });
    updateAccountType();
  }

  return Object.freeze({ init });
})();
