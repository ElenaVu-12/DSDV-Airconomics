// bubbleChart.js

let svg, chartG, xAxisG, yAxisG;
let xScale, yScale, rScale;
let countries = [];
let allYears = [];
let currentYearIndex = 0;

let isPlaying = false;
let playTimer = null;

let yearWatermark;

const margin = { top: 40, right: 40, bottom: 60, left: 80 };

const tooltip = d3.select("#tooltip")
  .style("position", "absolute")
  .style("pointer-events", "none")
  .style("opacity", 0);

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
    .range(["#4e79a7", "#f28e2b", "#e15759", "#76b7b2", "#59a14f", "#edc948", "#b07aa1", "#ff9da7"]);

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
    .style("font-size", Math.min(innerWidth, innerHeight) * 0.4)
    .style("fill", "#e5e5e5")
    .style("opacity", 0.6)
    .style("pointer-events", "none")
    .text(allYears[currentYearIndex]);

  // First render
  renderBubble(allYears[currentYearIndex]);

  // Controls
  initYearControls();
}

// ======= RENDER BUBBLES =======
function renderBubble(year) {
  const dataForYear = getDataForYear(countries, year);

  d3.select("#yearLabel").text(year);

  // update watermark year
  if (yearWatermark) {
    yearWatermark
      .transition().duration(300)
      .tween("text", function () {
        const that = d3.select(this);
        const i = d3.interpolateNumber(+that.text(), year);
        return t => that.text(Math.round(i(t)));
      });
  }

  const dots = chartG.selectAll(".dot")
    .data(dataForYear, d => d.country);

  const dotsEnter = dots.enter().append("circle")
    .attr("class", "dot")
    .attr("cx", d => xScale(d.gdp || 1))
    .attr("cy", d => yScale(d.pm25 || 0))
    .attr("r", 0)
    .attr("fill", d => REGION_COLORS(d.region || "Other"))
    .attr("stroke", "white")
    .attr("stroke-width", 1)
    .attr("opacity", 0.85);

  const dotsMerged = dotsEnter.merge(dots);

  // Tooltip handler rebind every render (year always correct)
  dotsMerged
    .on("mousemove", (event, d) => {
      tooltip
        .style("opacity", 1)
        .style("left", (event.pageX + 12) + "px")
        .style("top", (event.pageY + 12) + "px")
        .html(
          `<b>${d.country}</b><br/>
           Region: ${d.region}<br/>
           PM2.5: ${d.pm25.toFixed(1)} µg/m³<br/>
           GDP pc: ${d3.format(",")(d.gdp)} USD<br/>
           Population: ${d3.format(",")(d.population)}<br/>
           Year: ${year}`
        );
    })
    .on("mouseleave", () => tooltip.style("opacity", 0));

  // Animate enter + update
  dotsEnter
    .transition().duration(500)
    .attr("r", d => rScale(d.population || 0));

  dotsMerged
    .transition().duration(500)
    .attr("cx", d => xScale(d.gdp || 1))
    .attr("cy", d => yScale(d.pm25 || 0))
    .attr("r", d => rScale(d.population || 0))
    .attr("fill", d => REGION_COLORS(d.region || "Other"));

  // Exit
  dots.exit()
    .transition().duration(300)
    .attr("r", 0)
    .remove();
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
      tooltip.style("opacity", 0); // avoid stale tooltip
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
          tooltip.style("opacity", 0);
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

// ======= ENTRY POINT =======
loadData()
  .then((loadedCountries) => {
    console.log("Loaded countries:", loadedCountries.length);
    initBubbleChart(loadedCountries);
  })
  .catch(err => console.error("Error init bubble chart:", err));
