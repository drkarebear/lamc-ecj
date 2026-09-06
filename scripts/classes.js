(function () {
      "use strict";

      const DATA_URL = "data/classes.json";
      const SIS_URL = "https://mycollege-guest.laccd.edu/psc/classsearchguest/EMPLOYEE/HRMS/c/COMMUNITY_ACCESS.CLASS_SEARCH.GBL";
      const departmentOrder = ["English", "Communication Studies", "Journalism"];
      const formatOrder = ["In Person", "Online", "Zoom", "In Person Hybrid", "Zoom Hybrid"];
      const materialOrder = ["ZTC", "Low Cost"];

      const ecjPrograms = [
        {
          label: "English AA-T",
          courses: [
            "ENGL C1000", "ENGL C1000E", "ENGLISH 101Z", "ENGL C1001", "ENGLISH 102",
            "ENGLISH 203", "ENGLISH 205", "ENGLISH 206", "ENGLISH 208", "ENGLISH 127",
            "ENGLISH 218", "ENGLISH 78", "ENGLISH 124", "ENGLISH 223", "ENGLISH 32",
            "ENGLISH 109", "ENGLISH 239", "ENGLISH 240", "ENGLISH 241", "JOURNAL 101", "COMM 130"
          ]
        },
        {
          label: "Communication Studies AA-T",
          courses: [
            "COMM C1000", "COMM 121", "COMM 104", "COMM 151", "COMM 122", "COMM 100",
            "COMM 190", "COMM 130", "COMM 102", "COMM 109", "ENGLISH 102", "ENGL C1001", "JOURNAL 101"
          ]
        },
        {
          label: "Creative Writing Certificate",
          courses: [
            "ENGLISH 127", "ENGLISH 223", "ENGLISH 78", "ENGLISH 32", "ENGLISH 124",
            "JOURNAL 101", "ENGLISH 109"
          ]
        },
        {
          label: "Journalism Certificate",
          courses: ["JOURNAL 100", "JOURNAL 101", "JOURNAL 43", "JOURNAL 202", "ENGLISH 223"]
        },
        {
          label: "Social Media Strategist Certificate",
          courses: ["COMM 122", "ENGLISH 109", "JOURNAL 43", "COMM 109", "COMM 190"]
        }
      ];

      function normalizedCourseCode(value) {
        return String(value || "")
          .toUpperCase()
          .trim()
          .replace(/\s+/g, " ")
          .replace(/\b(ENGLISH|JOURNAL|COMM) 0+(\d+)\b/g, "$1 $2");
      }

      const ecjProgramCourseSets = ecjPrograms.map((program) => ({
        label: program.label,
        courses: new Set(program.courses.map(normalizedCourseCode))
      }));

      function programsForCourse(section) {
        const courseCode = normalizedCourseCode(section && section.course);
        if (!courseCode) return [];
        return ecjProgramCourseSets
          .filter((program) => program.courses.has(courseCode))
          .map((program) => program.label);
      }

      // Concise, student-friendly descriptions based on the LAMC 2026–2027 catalog.
      const courseDescriptions = {
        "COMM C1000": "Build confidence speaking, researching, and persuading an audience.",
        "COMM 100": "Explore how people communicate and why it matters.",
        "COMM 101": "Build confidence speaking and presenting to an audience.",
        "COMM 102": "Strengthen speaking, research, argument, and critical-thinking skills.",
        "COMM 104": "Build and challenge arguments using evidence and logic.",
        "COMM 109": "Create engaging social media messages for different audiences.",
        "COMM 121": "Understand communication in personal and professional relationships.",
        "COMM 122": "Communicate more effectively across cultures and communities.",
        "COMM 130": "Bring stories, poetry, and drama to life.",
        "COMM 151": "Build teamwork, leadership, problem-solving, and conflict-management skills.",
        "COMM 190": "Create digital content while exploring today’s media.",
        "ENGL C1000": "Build college reading, writing, research, and thinking skills.",
        "ENGL C1000E": "Build college writing skills with extra built-in support.",
        "ENGL C1001": "Analyze ideas and build strong, evidence-based arguments.",
        "ENGLISH 021": "Strengthen foundational reading, writing, grammar, and essay skills.",
        "ENGLISH 028": "Build stronger reading, essay, argument, and research skills.",
        "ENGLISH 032": "Help edit and produce the college literary magazine.",
        "ENGLISH 101": "Build college reading, writing, research, and thinking skills.",
        "ENGLISH 101X": "Build college writing skills with extra support.",
        "ENGLISH 101Y": "Complete college composition with additional writing support.",
        "ENGLISH 101Z": "Complete college composition with more intensive built-in support.",
        "ENGLISH 102": "Read literature and build strong analytical writing skills.",
        "ENGLISH 103": "Analyze ideas and build evidence-based arguments.",
        "ENGLISH 107": "Build critical thinking through literature, research, and writing.",
        "ENGLISH 109": "Create clear, engaging writing for social media audiences.",
        "ENGLISH 124": "Write, revise, and prepare short stories for publication.",
        "ENGLISH 127": "Explore fiction, poetry, nonfiction, and performance writing.",
        "ENGLISH 203": "Explore world literature from ancient to early modern times.",
        "ENGLISH 204": "Explore world literature from the 1600s to today.",
        "ENGLISH 205": "Explore British literature from its beginnings through the 1800s.",
        "ENGLISH 206": "Explore British literature from the 1800s to today.",
        "ENGLISH 208": "Explore American voices from the 1800s to today.",
        "ENGLISH 218": "Explore children’s stories across cultures, genres, and generations.",
        "ENGLISH 223": "Turn real experiences and subjects into compelling stories.",
        "ENGLISH 239": "Explore women’s lives and identities through literature.",
        "ENGLISH 240": "Compare books and stories with their film adaptations.",
        "ENGLISH 241": "Explore how filmmakers transform literature for the screen.",
        "ENGLISH 420": "Design research and evaluate evidence-based studies.",
        "JOURNAL 043": "Create professional PR materials for real-world communication.",
        "JOURNAL 100": "Explore how media influences people, culture, and society.",
        "JOURNAL 101": "Find, report, and write accurate news stories.",
        "JOURNAL 202": "Develop advanced reporting, feature, and editorial writing skills."
      };

      const state = { data: null };

      const termFilter = document.getElementById("term-filter");
      const subjectFilter = document.getElementById("subject-filter");
      const formatFilter = document.getElementById("format-filter");
      const materialsFilter = document.getElementById("materials-filter");
      const searchFilter = document.getElementById("search-filter");
      const includeInProgress = document.getElementById("include-in-progress");
      const progressToggleWrap = document.getElementById("progress-toggle-wrap");
      const results = document.getElementById("results");
      const summary = document.getElementById("result-summary");
      const lastUpdated = document.getElementById("last-updated");
      const clearButton = document.getElementById("clear-filters");
      const filterForm = document.getElementById("class-filters");

      function element(tag, className, text) {
        const node = document.createElement(tag);
        if (className) node.className = className;
        if (typeof text === "string") node.textContent = text;
        return node;
      }

      function availability() {
        const checked = filterForm.querySelector('input[name="availability"]:checked');
        return checked ? checked.value : "open";
      }

      function selectedTerm() {
        if (!state.data || !Array.isArray(state.data.terms)) return null;
        return state.data.terms.find((term) => term.id === termFilter.value) || state.data.terms[0] || null;
      }

      function formatDate(value) {
        if (!value) return "The automated refresh has not run yet.";
        const date = new Date(value);
        if (Number.isNaN(date.getTime())) return value;
        return "Last refreshed " + new Intl.DateTimeFormat("en-US", {
          timeZone: "America/Los_Angeles",
          month: "short",
          day: "numeric",
          year: "numeric",
          hour: "numeric",
          minute: "2-digit",
          timeZoneName: "short"
        }).format(date) + ".";
      }

      function naturalCompare(a, b) {
        return String(a).localeCompare(String(b), undefined, { numeric: true, sensitivity: "base" });
      }

      function todayLocal() {
        const now = new Date();
        return new Date(now.getFullYear(), now.getMonth(), now.getDate());
      }

      function parseUsDate(value) {
        const match = String(value || "").match(/\b(\d{2})\/(\d{2})\/(\d{4})\b/);
        if (!match) return null;
        return new Date(Number(match[3]), Number(match[1]) - 1, Number(match[2]));
      }

      function sectionStartDate(section) {
        if (section.start_date) {
          const parts = String(section.start_date).split("-").map(Number);
          if (parts.length === 3 && parts.every(Number.isFinite)) {
            return new Date(parts[0], parts[1] - 1, parts[2]);
          }
        }
        return parseUsDate(section.dates);
      }

      function hasStarted(section) {
        const start = sectionStartDate(section);
        if (!start) return false;
        return start < todayLocal();
      }

      function compareSectionStartDate(a, b) {
        const aStart = sectionStartDate(a);
        const bStart = sectionStartDate(b);

        if (aStart && bStart) {
          const difference = aStart.getTime() - bStart.getTime();
          if (difference) return difference;
        } else if (aStart) {
          return -1;
        } else if (bStart) {
          return 1;
        }

        return naturalCompare(a.class_number, b.class_number);
      }

      function dedupeRepeatedPhrase(value) {
        const raw = String(value || "").trim();
        const commaParts = raw.split(/\s*,\s*/).filter(Boolean);
        if (commaParts.length > 1 && commaParts.every((part) => part === commaParts[0])) {
          return commaParts[0];
        }
        const words = raw.split(/\s+/).filter(Boolean);
        if (words.length < 2) return String(value || "").trim();
        for (let size = 1; size <= Math.floor(words.length / 2); size += 1) {
          if (words.length % size !== 0) continue;
          const phrase = words.slice(0, size);
          let repeated = true;
          for (let i = size; i < words.length; i += size) {
            if (words.slice(i, i + size).join(" ") !== phrase.join(" ")) {
              repeated = false;
              break;
            }
          }
          if (repeated) return phrase.join(" ");
        }
        return words.join(" ");
      }

      function normalizedFormat(section) {
        const haystack = [
          section.format,
          section.room,
          section.schedule,
          section.details
        ].filter(Boolean).join(" ").toLowerCase();

        const hybrid = /\bhybrid\b|\bblended\b/.test(haystack);
        const live = /\bonline live\b|\bzoom\b/.test(haystack);
        const online = /\bonline\b/.test(haystack);
        const physical = /mission-(?!online\b)[a-z0-9]/i.test(haystack);

        if ((hybrid && live) || (live && physical)) return "Zoom Hybrid";
        if (hybrid) return "In Person Hybrid";
        if (live) return "Zoom";
        if (online && !physical) return "Online";
        if (online && physical) return "In Person Hybrid";
        return "In Person";
      }

      function materialFlags(section) {
        const provided = Array.isArray(section.materials) ? section.materials : [];
        const haystack = [
          section.materials_text,
          section.details,
          section.room,
          section.schedule
        ].filter(Boolean).join(" ");

        const flags = new Set();
        provided.forEach((item) => {
          const value = String(item).toLowerCase();
          if (value === "ztc" || value.includes("zero textbook")) flags.add("ZTC");
          if (value === "low cost" || value.includes("low textbook") || value.includes("low cost textbook")) flags.add("Low Cost");
        });

        if (/\bZTC\b|Zero\s+Textbook\s+Cost/i.test(haystack)) flags.add("ZTC");
        if (/\bLCT\b|\bLTC\b|Low\s+Textbook\s+Cost|Low\s+Cost\s+Textbook/i.test(haystack)) flags.add("Low Cost");

        return materialOrder.filter((item) => flags.has(item));
      }

      function formatBadgeClass(format) {
        return "format-" + String(format).toLowerCase().replace(/\s+/g, "-");
      }

      function materialBadgeClass(flag) {
        return flag === "Low Cost" ? "material-low-cost" : "material-ztc";
      }

      function displayLocation(section, format) {
        if (format === "Online") return "Online";
        if (format === "Zoom") return "Zoom";
        if (format === "Zoom Hybrid") return "Online + scheduled Zoom";

        const room = dedupeRepeatedPhrase(section.room || "");
        const match = room.match(/Mission-(?!Online\b)(.*?)(?=\s+Mission-|$)/i);
        let physical = match ? match[1].trim() : room.replace(/^Mission-/i, "").trim();

        if (!physical || /^Online\b/i.test(physical)) {
          physical = format === "In Person Hybrid" ? "Campus + online" : "";
        }
        if (format === "In Person Hybrid" && physical && !/\bonline\b/i.test(physical)) {
          return physical + " + online";
        }
        return physical;
      }

      function displayDates(section) {
        if (section.start_date && section.end_date) {
          const startParts = String(section.start_date).split("-").map(Number);
          const endParts = String(section.end_date).split("-").map(Number);
          if (startParts.length === 3 && endParts.length === 3) {
            const start = new Date(startParts[0], startParts[1] - 1, startParts[2]);
            const end = new Date(endParts[0], endParts[1] - 1, endParts[2]);
            const sameYear = start.getFullYear() === end.getFullYear();
            const dateFmt = { month: "short", day: "numeric" };
            const startText = new Intl.DateTimeFormat("en-US", dateFmt).format(start);
            const endText = new Intl.DateTimeFormat("en-US", {
              month: "short",
              day: "numeric",
              year: "numeric"
            }).format(end);
            return startText + "–" + endText;
          }
        }

        const matches = [...String(section.dates || "").matchAll(/(\d{2}\/\d{2}\/\d{4})\s*-\s*(\d{2}\/\d{2}\/\d{4})/g)];
        if (!matches.length) return section.dates || "";
        const starts = matches.map((m) => parseUsDate(m[1])).filter(Boolean);
        const ends = matches.map((m) => parseUsDate(m[2])).filter(Boolean);
        if (!starts.length || !ends.length) return matches[0][0];
        const start = new Date(Math.min(...starts.map((d) => d.getTime())));
        const end = new Date(Math.max(...ends.map((d) => d.getTime())));
        const startText = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" }).format(start);
        const endText = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" }).format(end);
        return startText + "–" + endText;
      }

      function dayLabel(code) {
        const labels = { Mo: "Mon", Tu: "Tue", We: "Wed", Th: "Thu", Fr: "Fri", Sa: "Sat", Su: "Sun" };
        const parts = String(code || "").match(/Mo|Tu|We|Th|Fr|Sa|Su/g) || [];
        return parts.map((part) => labels[part] || part).join("/");
      }

      function meetingFromDetails(section, format) {
        let schedule = String(section.schedule || "").trim();
        if (schedule && !looksLikeMeeting(schedule)) schedule = "";

        const source = [schedule, section.details].filter(Boolean).join(" ");
        const match = source.match(/\b((?:Mo|Tu|We|Th|Fr|Sa|Su)+)\s+(\d{1,2}:\d{2}\s*(?:AM|PM))\s*-\s*(\d{1,2}:\d{2}\s*(?:AM|PM))/i);
        if (match) {
          return dayLabel(match[1]) + " · " + match[2].replace(/\s+/g, " ") + "–" + match[3].replace(/\s+/g, " ");
        }

        if (format === "Online") return "No scheduled meeting time";
        if (/\bTBA\b/i.test(source)) return "TBA";
        return schedule;
      }

      function displayInstructor(section) {
        let instructor = dedupeRepeatedPhrase(section.instructor || "");
        let schedule = String(section.schedule || "").trim();
        if (!instructor && schedule && !looksLikeMeeting(schedule)) {
          instructor = dedupeRepeatedPhrase(schedule);
        }
        return instructor;
      }

      function looksLikeMeeting(value) {
        if (!value) return false;
        return /(TBA|\bMo\b|\bTu\b|\bWe\b|\bTh\b|\bFr\b|\bSa\b|\bSu\b|\d{1,2}:\d{2}\s*(?:AM|PM)|Zoom|Hybrid)/i.test(value);
      }

      function englishCourseSortKey(section) {
        const subject = String(section.subject_code || "").toUpperCase();
        const number = String(section.course_number || "").toUpperCase();
        const exact = subject + " " + number;
        const priority = {
          "ENGL C1000": 0,
          "ENGL C1000E": 1,
          "ENGL C1001": 2,
          "ENGLISH 102": 3
        };
        if (Object.prototype.hasOwnProperty.call(priority, exact)) {
          return [0, priority[exact], "", ""];
        }

        const numericMatch = number.match(/\d+/);
        const numeric = numericMatch ? Number(numericMatch[0]) : 999999;
        const suffix = number.replace(/^\D*\d+/, "");
        return [1, numeric, suffix, exact];
      }

      function communicationCourseSortKey(section) {
        const exact = String(section.course || "").toUpperCase().trim();
        if (exact === "COMM C1000") return [0, 0, ""];

        const number = String(section.course_number || "").toUpperCase();
        const numericMatch = number.match(/\d+/);
        const numeric = numericMatch ? Number(numericMatch[0]) : 999999;
        return [1, numeric, number];
      }

      function compareCourseSections(a, b) {
        if (a.department === "English" && b.department === "English") {
          const ak = englishCourseSortKey(a);
          const bk = englishCourseSortKey(b);
          for (let i = 0; i < ak.length; i += 1) {
            if (typeof ak[i] === "number" && typeof bk[i] === "number") {
              if (ak[i] !== bk[i]) return ak[i] - bk[i];
            } else {
              const cmp = naturalCompare(ak[i], bk[i]);
              if (cmp) return cmp;
            }
          }
          return naturalCompare(a.class_number, b.class_number);
        }

        if (a.department === "Communication Studies" && b.department === "Communication Studies") {
          const ak = communicationCourseSortKey(a);
          const bk = communicationCourseSortKey(b);
          for (let i = 0; i < ak.length; i += 1) {
            if (typeof ak[i] === "number" && typeof bk[i] === "number") {
              if (ak[i] !== bk[i]) return ak[i] - bk[i];
            } else {
              const cmp = naturalCompare(ak[i], bk[i]);
              if (cmp) return cmp;
            }
          }
          return naturalCompare(a.class_number, b.class_number);
        }

        const number = naturalCompare(a.course_number, b.course_number);
        if (number) return number;
        return naturalCompare(a.class_number, b.class_number);
      }

      function friendlyCourseDescription(section) {
        const key = String(section.course || "").toUpperCase();
        return courseDescriptions[key] || "";
      }

      function currentSections() {
        const term = selectedTerm();
        if (!term || !Array.isArray(term.sections)) return [];

        const view = availability();
        const subject = subjectFilter.value;
        const format = formatFilter.value;
        const material = materialsFilter.value;
        const query = searchFilter.value.trim().toLowerCase();
        const includeStarted = includeInProgress.checked;

        return term.sections.filter((section) => {
          if (view === "open" && section.status !== "Open") return false;
          if (view === "open" && !includeStarted && hasStarted(section)) return false;
          if (subject !== "all" && section.department !== subject) return false;

          const normalized = normalizedFormat(section);
          if (format !== "all" && normalized !== format) return false;

          const flags = materialFlags(section);
          if (material !== "all" && !flags.includes(material)) return false;

          if (query) {
            const haystack = [
              section.course,
              section.course_number,
              section.title,
              friendlyCourseDescription(section),
              section.class_number,
              section.section,
              displayInstructor(section),
              section.schedule,
              section.room,
              normalized,
              flags.join(" ")
            ].filter(Boolean).join(" ").toLowerCase();
            if (!haystack.includes(query)) return false;
          }
          return true;
        }).sort((a, b) => {
          const dept = departmentOrder.indexOf(a.department) - departmentOrder.indexOf(b.department);
          if (dept) return dept;
          const course = compareCourseSections(a, b);
          if (course) return course;
          return compareSectionStartDate(a, b);
        });
      }

      function populateTerms() {
        termFilter.replaceChildren();
        const terms = state.data && Array.isArray(state.data.terms) ? state.data.terms : [];
        terms.forEach((term) => {
          const option = document.createElement("option");
          option.value = term.id;
          option.textContent = term.label;
          termFilter.appendChild(option);
        });
      }

      function populateFormats() {
        const previous = formatFilter.value || "all";
        const term = selectedTerm();
        const available = new Set(
          term && Array.isArray(term.sections)
            ? term.sections.map(normalizedFormat)
            : []
        );

        formatFilter.replaceChildren();
        const all = document.createElement("option");
        all.value = "all";
        all.textContent = "All formats";
        formatFilter.appendChild(all);

        formatOrder.filter((format) => available.has(format)).forEach((format) => {
          const option = document.createElement("option");
          option.value = format;
          option.textContent = format;
          formatFilter.appendChild(option);
        });

        formatFilter.value = [...formatFilter.options].some((option) => option.value === previous) ? previous : "all";
      }

      function populateMaterials() {
        const previous = materialsFilter.value || "all";
        const term = selectedTerm();
        const available = new Set();

        if (term && Array.isArray(term.sections)) {
          term.sections.forEach((section) => materialFlags(section).forEach((flag) => available.add(flag)));
        }

        materialsFilter.replaceChildren();
        const all = document.createElement("option");
        all.value = "all";
        all.textContent = "All materials";
        materialsFilter.appendChild(all);

        materialOrder.filter((flag) => available.has(flag)).forEach((flag) => {
          const option = document.createElement("option");
          option.value = flag;
          option.textContent = flag;
          materialsFilter.appendChild(option);
        });

        materialsFilter.disabled = available.size === 0;
        materialsFilter.title = available.size === 0
          ? "No ZTC or Low Cost flags were detected in the current SIS feed."
          : "";

        materialsFilter.value = [...materialsFilter.options].some((option) => option.value === previous) ? previous : "all";
      }

      function syncProgressControl() {
        const openOnly = availability() === "open";
        progressToggleWrap.hidden = !openOnly;
        includeInProgress.disabled = !openOnly;
      }

      function addMetaItem(dl, label, value) {
        if (!value) return;
        const wrap = element("div", "section-meta-item");
        wrap.appendChild(element("dt", "", label));
        wrap.appendChild(element("dd", "", value));
        dl.appendChild(wrap);
      }

      function statusClass(status) {
        return "status-" + String(status || "unknown").toLowerCase().replace(/\s+/g, "-");
      }

      async function copyClassNumber(button, classNumber, statusNode) {
        if (!classNumber) {
          statusNode.textContent = "No Class Number is available to copy.";
          return;
        }

        try {
          if (navigator.clipboard && window.isSecureContext) {
            await navigator.clipboard.writeText(classNumber);
          } else {
            const textarea = document.createElement("textarea");
            textarea.value = classNumber;
            textarea.setAttribute("readonly", "");
            textarea.className = "clipboard-fallback-input";
            document.body.appendChild(textarea);
            textarea.select();
            const copied = document.execCommand("copy");
            textarea.remove();
            if (!copied) throw new Error("Copy command failed.");
          }

          const original = button.textContent;
          button.textContent = "Copied!";
          statusNode.textContent = "Class Number " + classNumber + " copied to your clipboard.";
          window.setTimeout(() => {
            button.textContent = original;
            statusNode.textContent = "";
          }, 2600);
        } catch (error) {
          statusNode.textContent = "Could not copy automatically. Class Number: " + classNumber + ".";
        }
      }

      function liveSectionUrl(section) {
        const term = selectedTerm();
        if (!section || !section.class_number || !term || !term.id) return SIS_URL;
        return SIS_URL +
          "?Campus=LAMC" +
          "&strm=" + encodeURIComponent(term.id) +
          "&classnum=" + encodeURIComponent(section.class_number) +
          "&";
      }

      function renderSectionRow(section, courseLabel, index) {
        const row = element("li", "section-row");
        const article = element("article", "");
        article.setAttribute("aria-labelledby", "section-" + section.class_number + "-" + index);

        const top = element("div", "section-row-top");
        const idBlock = element("div", "class-id-block");
        idBlock.appendChild(element("p", "class-id-label", "Class Number"));

        const heading = element("h5", "", section.class_number || "See live details");
        heading.id = "section-" + section.class_number + "-" + index;
        idBlock.appendChild(heading);

        if (section.section) {
          idBlock.appendChild(element("p", "section-code", "Section " + section.section));
        }

        const badges = element("div", "badge-row");
        const status = element("span", "status " + statusClass(section.status), section.status || "Status unknown");
        badges.appendChild(status);

        const format = normalizedFormat(section);
        badges.appendChild(element("span", "format-badge " + formatBadgeClass(format), format));

        materialFlags(section).forEach((flag) => {
          const badge = element("span", "material-badge " + materialBadgeClass(flag), flag);
          if (flag === "ZTC") badge.setAttribute("aria-label", "Zero Textbook Cost");
          if (flag === "Low Cost") badge.setAttribute("aria-label", "Low Textbook Cost");
          badges.appendChild(badge);
        });

        if (hasStarted(section)) {
          const start = sectionStartDate(section);
          const label = start
            ? "Started " + new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" }).format(start)
            : "In progress";
          badges.appendChild(element("span", "started-badge", label));
        }

        top.append(idBlock, badges);
        article.appendChild(top);

        const dl = element("dl", "section-meta");
        addMetaItem(dl, "Meets", meetingFromDetails(section, format));
        addMetaItem(dl, "Location", displayLocation(section, format));
        addMetaItem(dl, "Instructor", displayInstructor(section));
        addMetaItem(dl, "Dates", displayDates(section));
        article.appendChild(dl);

        const actions = element("div", "card-actions");
        const copy = element("button", "copy-button", "Copy Number");
        copy.type = "button";
        copy.setAttribute(
          "aria-label",
          "Copy class number " + (section.class_number || "") + (courseLabel ? " for " + courseLabel : "")
        );

        const link = element("a", "sis-link", "Section Details");
        link.href = liveSectionUrl(section);
        link.rel = "noopener noreferrer";
        link.setAttribute(
          "aria-label",
          "Open section details for " + (courseLabel || "this course") + ", class " + (section.class_number || "")
        );

        actions.append(copy, link);
        article.appendChild(actions);

        const copyStatus = element("span", "copy-status", "");
        copyStatus.setAttribute("role", "status");
        copyStatus.setAttribute("aria-live", "polite");
        article.appendChild(copyStatus);

        copy.addEventListener("click", () => {
          copyClassNumber(copy, section.class_number || "", copyStatus);
        });

        row.appendChild(article);
        return row;
      }

      function groupCourses(departmentSections) {
        const groups = [];
        const map = new Map();

        departmentSections.forEach((section) => {
          const key = (section.course || "Course") + "|" + (section.title || "");
          if (!map.has(key)) {
            const group = { key, sections: [] };
            map.set(key, group);
            groups.push(group);
          }
          map.get(key).sections.push(section);
        });

        groups.sort((a, b) => compareCourseSections(a.sections[0], b.sections[0]));
        groups.forEach((group) => {
          group.sections.sort(compareSectionStartDate);
        });
        return groups;
      }

      function render() {
        const term = selectedTerm();
        const sections = currentSections();
        results.replaceChildren();
        syncProgressControl();

        if (!term) {
          summary.textContent = "No semester data is available.";
          const box = element("div", "error-state");
          box.appendChild(element("h3", "", "Class data is not available yet"));
          box.appendChild(element("p", "", "Use the official LACCD public Class Search while this page is being set up."));
          const link = element("a", "", "Open the official LACCD public Class Search");
          link.href = SIS_URL;
          link.rel = "noopener noreferrer";
          box.appendChild(link);
          results.appendChild(box);
          return;
        }

        const view = availability();
        const descriptor = view === "open"
          ? (includeInProgress.checked ? "open" : "upcoming open")
          : "matching";
        summary.textContent = sections.length + " " + descriptor + (sections.length === 1 ? " section" : " sections") + " found for " + term.label + ".";

        if (!Array.isArray(term.sections) || term.sections.length === 0) {
          const box = element("div", "error-state");
          box.appendChild(element("h3", "", "The automated class feed has not populated yet"));
          box.appendChild(element("p", "", "After the GitHub Action runs for the first time, this page will fill with ECJ sections automatically. Until then, use the official LACCD public Class Search."));
          const link = element("a", "", "Open the official LACCD public Class Search");
          link.href = SIS_URL;
          link.rel = "noopener noreferrer";
          box.appendChild(link);
          results.appendChild(box);
          return;
        }

        if (sections.length === 0) {
          const box = element("div", "empty-state");
          box.appendChild(element("h3", "", "No classes match these filters"));
          box.appendChild(element("p", "", view === "open"
            ? "Try including classes already in progress, choosing All ECJ Classes, or clearing a filter."
            : "Try clearing a subject, format, materials, or search filter."));
          results.appendChild(box);
          return;
        }

        departmentOrder.forEach((department) => {
          const departmentSections = sections.filter((section) => section.department === department);
          if (!departmentSections.length) return;

          const departmentGroup = element("section", "department-group");
          departmentGroup.dataset.department = department;

          const headingId = "department-" + department.toLowerCase().replace(/\s+/g, "-");
          departmentGroup.setAttribute("aria-labelledby", headingId);

          const headingWrap = element("div", "department-heading-wrap");
          headingWrap.appendChild(element("p", "department-kicker", "ECJ Subject"));
          const deptHeading = element("h3", "department-heading", department);
          deptHeading.id = headingId;
          headingWrap.appendChild(deptHeading);
          departmentGroup.appendChild(headingWrap);

          const courseGroups = groupCourses(departmentSections);

          courseGroups.forEach((course, courseIndex) => {
            const first = course.sections[0];
            const courseWrap = element("section", "course-group");
            const panel = element("div", "course-panel");
            const panelHeader = element("div", "course-panel-header");
            const headingText = (first.course || "Course") + (first.title ? ": " + first.title : "");
            const courseHeading = element("h4", "course-heading", headingText);
            const courseHeadingId = headingId + "-course-" + courseIndex;
            courseHeading.id = courseHeadingId;
            courseWrap.setAttribute("aria-labelledby", courseHeadingId);
            panelHeader.appendChild(courseHeading);
            const description = friendlyCourseDescription(first);
            if (description) {
              panelHeader.appendChild(element("p", "course-description", description));
            }

            const programLabels = programsForCourse(first);
            if (programLabels.length) {
              const tagWrap = element("div", "program-tags");
              tagWrap.setAttribute("aria-label", "ECJ programs this course can count toward");
              programLabels.forEach((label) => {
                const tag = element("span", "program-tag", label);
                tag.setAttribute("title", "Can count toward " + label);
                tagWrap.appendChild(tag);
              });
              panelHeader.appendChild(tagWrap);
            }

            panelHeader.appendChild(
              element(
                "p",
                "course-count",
                course.sections.length + (course.sections.length === 1 ? " matching section" : " matching sections")
              )
            );
            panel.appendChild(panelHeader);

            const list = element("ul", "section-list");
            course.sections.forEach((section, sectionIndex) => {
              list.appendChild(renderSectionRow(section, headingText, sectionIndex));
            });
            panel.appendChild(list);
            courseWrap.appendChild(panel);
            departmentGroup.appendChild(courseWrap);
          });

          results.appendChild(departmentGroup);
        });
      }

      function resetFilters() {
        document.getElementById("view-open").checked = true;
        includeInProgress.checked = false;
        subjectFilter.value = "all";
        formatFilter.value = "all";
        materialsFilter.value = "all";
        searchFilter.value = "";
        render();
      }

      filterForm.addEventListener("submit", (event) => {
        event.preventDefault();
        render();
      });

      filterForm.addEventListener("change", (event) => {
        if (event.target === termFilter) {
          populateFormats();
          populateMaterials();
        }
        render();
      });

      searchFilter.addEventListener("input", render);
      clearButton.addEventListener("click", resetFilters);

      fetch(DATA_URL, { cache: "no-store" })
        .then((response) => {
          if (!response.ok) throw new Error("Class data could not be loaded.");
          return response.json();
        })
        .then((data) => {
          state.data = data;
          lastUpdated.textContent = formatDate(data.generated_at);
          populateTerms();

          const requestedParams = new URLSearchParams(window.location.search);
          const requestedTerm = requestedParams.get("term");
          if (requestedTerm && [...termFilter.options].some((option) => option.value === requestedTerm)) {
            termFilter.value = requestedTerm;
          }

          populateFormats();
          populateMaterials();

          const requestedClass = requestedParams.get("class");
          if (requestedClass && /^\d{5}$/.test(requestedClass)) {
            searchFilter.value = requestedClass;
            document.getElementById("view-all").checked = true;
          }

          render();
        })
        .catch(() => {
          summary.textContent = "Class data could not be loaded.";
          lastUpdated.textContent = "The saved class list could not be loaded.";
          results.replaceChildren();
          const box = element("div", "error-state");
          box.appendChild(element("h3", "", "Use the official class search for now"));
          box.appendChild(element("p", "", "The ECJ class feed is temporarily unavailable. The official LACCD public Class Search remains available."));
          const link = element("a", "", "Open the official LACCD public Class Search");
          link.href = SIS_URL;
          link.rel = "noopener noreferrer";
          box.appendChild(link);
          results.appendChild(box);
        });
    }());
