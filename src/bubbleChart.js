// bubbleChart.js


let svg, chartG, xAxisG, yAxisG;
let xScale, yScale, rScale;
let countries = [];
let allYears = [];
let currentYearIndex = 0;
let currentYear = null;

let isPlaying = false;
let playTimer = null;

let yearWatermark;

let currentRegion = "all";

const margin = { top: 40, right: 40, bottom: 60, left: 80 };

const tooltip = d3.select("#tooltip")
  .style("position", "absolute")
  .style("pointer-events", "none")
  

// Color by region
let REGION_COLORS;

// ======= INIT CHART =======
function initBubbleChart(loadedCountries) {
  countries = loadedCountries;

  // Years list (from pm25 keys)
  allYears = Object.keys(countries[0].pm25).map(Number).sort((a, b) => a - b);
  currentYearIndex = 0;

  // Setup SVG
  const container = d3.select("#chart");
  const rect = container.node().getBoundingClientRect();
  const width = rect.width || 900;
  const height = rect.height || 550;

  svg = container.append("svg")
    .attr("width", width)
    .attr("height", height);

  const innerWidth = width - margin.left - margin.right;
  const innerHeight = height - margin.top - margin.bottom;

  chartG = svg.append("g")
    .attr("transform", `translate(${margin.left},${margin.top})`);

  // --- Scales from dataPrep (GLOBAL fixed) ---
  const domains = computeGlobalDomains(countries);
  const scales = makeGlobalScales(width, height, margin, domains);
  xScale = scales.xScale;
  yScale = scales.yScale;
  rScale = scales.rScale;

  // --- region color scale ---
  const regions = Array.from(new Set(countries.map(c => c.region || "Other")));
  REGION_COLORS = d3.scaleOrdinal()
    .domain(regions)
    .range(["#4e79a7", "#f28e2b", "#e15759", "#76b7b2", "#59a14f"]);

  // --- Axes ---
  xAxisG = chartG.append("g")
    .attr("class", "x-axis")
    .attr("transform", `translate(0,${innerHeight})`)
    .call(d3.axisBottom(xScale).ticks(6, "~s"));

  yAxisG = chartG.append("g")
    .attr("class", "y-axis")
    .call(d3.axisLeft(yScale));

  // -- Vertical grid --
  chartG.append("g")
  .attr("class", "grid grid-x")
  .attr("transform", `translate(0,${innerHeight})`)
  .call(
    d3.axisBottom(xScale)
      .tickValues([1e6, 1e7, 1e8, 1e9, 1e10, 1e11, 1e12]) // ticks lớn, không bị rối
      .tickSize(-innerHeight)
      .tickFormat("")
  );

  // --- Horizontal grid ---
  chartG.append("g")
    .attr("class", "grid grid-y")
    .call(
      d3.axisLeft(yScale)
        .ticks(10)
        .tickSize(-innerWidth)
        .tickFormat("")
    );

  // Labels
  chartG.append("text")
    .attr("class", "x-label")
    .attr("x", innerWidth)
    .attr("y", innerHeight + 45)
    .attr("text-anchor", "end")
    .text("GDP per capita (log scale)");

  chartG.append("text")
    .attr("class", "y-label")
    .attr("x", 0)
    .attr("y", -15)
    .attr("text-anchor", "start")
    .text("PM2.5 (µg/m³)");

  // Big year watermark (background)
  yearWatermark = chartG.append("text")
    .attr("class", "year-watermark")
    .attr("x", innerWidth / 2)
    .attr("y", innerHeight / 2)
    .attr("text-anchor", "middle")
    .attr("dominant-baseline", "middle")
    .style("font-size", Math.min(innerWidth, innerHeight) * 0.4)
    .style("fill", "#e5e5e5")
    .style("opacity", 0.6)
    .style("pointer-events", "none")
    .text(allYears[currentYearIndex]);

  // renderLegend
  renderLegend(innerWidth);


  // First render
  renderBubble(allYears[currentYearIndex]);

  // Controls
  initYearControls();

  // DROPDOWN REGION
  d3.select("#regionFilter")
    .on("change", function() {
      currentRegion = this.value;
      renderBubble(allYears[currentYearIndex]);
    });
}

// ======= RENDER BUBBLES =======
function renderBubble(year) {
  currentYear = year; // Update current year
  let dataForYear = getDataForYear(countries, year);

  if (currentRegion !== "all") {
    dataForYear = dataForYear.filter(d => d.region === currentRegion);
  }

  d3.select("#yearLabel").text(year);

  // update watermark year
  if (yearWatermark) {
    yearWatermark
      .attr("x", (svg.attr("width") - margin.left - margin.right) / 2)
      .attr("y", (svg.attr("height") - margin.top - margin.bottom) / 2)
      .transition().duration(300)
      .tween("text", function () {
        const that = d3.select(this);
        const i = d3.interpolateNumber(+that.text(), year);
        return t => that.text(Math.round(i(t)));
      });
  }

  chartG.selectAll(".dot")
  .data(dataForYear, d => d.country)
  .join(
    enter => enter.append("circle")
      .attr("class", "dot")
      .attr("cx", d => xScale(d.gdp || 1))
      .attr("cy", d => yScale(d.pm25 || 0))
      .attr("r", 0)
      .attr("fill", d => REGION_COLORS(d.region || "Other"))
      .attr("stroke", "white")
      .attr("stroke-width", 1)
      .attr("opacity", 0.85)
      .attr("pointer-events", "all")

      // TOOLTIP (ENTER)
      .on("mousemove", (event, d) => {
        tooltip
          .classed("show", true)
          .style("left", (event.pageX + 14) + "px")
          .style("top", (event.pageY - 10) + "px")
          .html(`
            <div class="tt-title">${d.country}</div>
            <div class="tt-sub">Region: ${d.region} • Year: ${currentYear}</div>
            <div class="tt-grid">
              <div class="tt-k">PM2.5</div><div class="tt-v">${d.pm25.toFixed(1)} µg/m³</div>
              <div class="tt-k">GDP pc</div><div class="tt-v">${d3.format("$,.0f")(d.gdp)}</div>
              <div class="tt-k">Population</div><div class="tt-v">${d3.format(",")(d.population)}</div>
            </div>
          `);
      })
      .on("mouseleave", () => tooltip.classed("show", false))
      .call(enter => enter
        .transition().duration(500)
        .attr("r", d => rScale(d.population || 0))
      ),

    update => update
      .call(update => update
        .transition().duration(500)
        .attr("cx", d => xScale(d.gdp || 1))
        .attr("cy", d => yScale(d.pm25 || 0))
        .attr("r", d => rScale(d.population || 0))
        .attr("fill", d => REGION_COLORS(d.region || "Other"))
      ),

    exit => exit
      .transition().duration(300)
      .attr("r", 0)
      .remove()
  );
}

// ======= SLIDER + PLAY/PAUSE =======
function initYearControls() {
  const slider = d3.select("#yearSlider");
  const playBtn = d3.select("#playBtn");

  slider
    .attr("min", allYears[0])
    .attr("max", allYears[allYears.length - 1])
    .attr("step", 1)
    .attr("value", allYears[currentYearIndex])
    .on("input", (event) => {
      const y = +event.target.value;
      currentYearIndex = allYears.indexOf(y);
      renderBubble(y);
      tooltip.classed("show", false); // avoid stale tooltip
    });

  playBtn.on("click", () => {
    if (!isPlaying) {
      isPlaying = true;
      playBtn.text("Pause");

      playTimer = setInterval(() => {
        if (currentYearIndex < allYears.length - 1) {
          currentYearIndex++;
          const y = allYears[currentYearIndex];
          slider.property("value", y);
          renderBubble(y);
          tooltip.classed("show", false);
        } else {
          clearInterval(playTimer);
          isPlaying = false;
          playBtn.text("▶ Play");
        }
      }, 900);

    } else {
      isPlaying = false;
      playBtn.text("▶ Play");
      clearInterval(playTimer);
    }
  });
}

function renderLegend(innerWidth) {
 
  chartG.selectAll(".legend").remove();

  const legendG = chartG.append("g")
    .attr("class", "legend")
    .attr("transform", `translate(${innerWidth - 170}, 0)`); // Top-Right Corner

  const items = REGION_COLORS.domain(); // Continent list

  const item = legendG.selectAll(".legend-item")
    .data(items)
    .enter()
    .append("g")
    .attr("class", "legend-item")
    .attr("transform", (d, i) => `translate(0, ${i * 18})`);

  item.append("circle")
    .attr("r", 6)
    .attr("cx", 0)
    .attr("cy", 0)
    .attr("fill", d => REGION_COLORS(d))
    .attr("stroke", "#fff")
    .attr("stroke-width", 1);

  item.append("text")
    .attr("x", 12)
    .attr("y", 4)
    .text(d => d);
}


// ======= ENTRY POINT =======
loadDataLong()
  .then(countries => initBubbleChart(countries))
  .catch(console.error);
