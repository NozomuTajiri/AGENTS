const menuToggle = document.querySelector(".menu-toggle");
const globalNav = document.querySelector(".global-nav");
const yearNode = document.getElementById("current-year");
const lastUpdatedNode = document.getElementById("last-updated");
const metricsGrid = document.getElementById("metrics-grid");

if (yearNode) {
  yearNode.textContent = String(new Date().getFullYear());
}

if (menuToggle && globalNav) {
  menuToggle.addEventListener("click", () => {
    const isExpanded = menuToggle.getAttribute("aria-expanded") === "true";
    menuToggle.setAttribute("aria-expanded", String(!isExpanded));
    globalNav.classList.toggle("is-open", !isExpanded);
  });

  globalNav.querySelectorAll("a").forEach((link) => {
    link.addEventListener("click", () => {
      menuToggle.setAttribute("aria-expanded", "false");
      globalNav.classList.remove("is-open");
    });
  });
}

async function hydrateSiteData() {
  if (!lastUpdatedNode || !metricsGrid) {
    return;
  }

  try {
    const response = await fetch("./dashboard-data.json", { cache: "no-store" });
    if (!response.ok) {
      throw new Error(`Failed to load site data: ${response.status}`);
    }

    const data = await response.json();
    const updatedAt = new Date(data.updatedAt);

    if (!Number.isNaN(updatedAt.getTime())) {
      lastUpdatedNode.textContent =
        `最終更新 ${updatedAt.getFullYear()}.${String(updatedAt.getMonth() + 1).padStart(2, "0")}.${String(updatedAt.getDate()).padStart(2, "0")}`;
    }

    if (Array.isArray(data.metrics) && data.metrics.length > 0) {
      metricsGrid.innerHTML = data.metrics
        .map(
          (metric) => `
            <article>
              <strong>${metric.value}</strong>
              <span>${metric.label}</span>
            </article>
          `,
        )
        .join("");
    }
  } catch (error) {
    lastUpdatedNode.textContent = "最新情報はお問い合わせください";
    console.error(error);
  }
}

hydrateSiteData();
