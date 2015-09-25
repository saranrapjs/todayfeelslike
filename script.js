var width = 960,
    height = 500,
    radius = Math.min(width, height) / 2;

var x = d3.scale.linear()
    .range([0, width]);




var color = d3.scale.ordinal()
    .range(["#98abc5", "#8a89a6", "#7b6888", "#6b486b", "#a05d56", "#d0743c", "#ff8c00"]);


var arc = d3.svg.arc()
    .outerRadius(radius - 10)
    .innerRadius(0);

var pie = d3.layout.pie()
    .sort(null)
    .value(function(d) { return d; });

var svg;

function update_counts(data) {
	var svg = d3.select(".chart")
	    .attr("width", width)
	    .attr("height", height)
	  .append("g")
	    .attr("transform", "translate(" + width / 2 + "," + height / 2 + ")");

	var g = svg.selectAll(".arc")
	      .data(pie(data))
	    .enter().append("g")
	      .attr("class", function(d,n) {
	      	return "arc " + moment().day(n).format('dddd').toLowerCase();
	      });

	  g.append("path")
	      .attr("d", arc)

	  g.append("text")
	      .attr("transform", function(d) { return "translate(" + arc.centroid(d) + ")"; })
	      .attr("dy", ".35em")
	      .style("text-anchor", "middle")
	      .text(function(d,n) { 
	      	return moment().day(n).format('dddd');
	      });
}

var next_time,
	from_now_el,
	now = moment();

window.addEventListener('load', function() {
	svg = d3.select(".chart")
		.attr("width", width)
		.attr("height", height)
		.append("g")
		.attr("transform", "translate(" + width / 2 + "," + height / 2 + ")");

	document.querySelector('.today').textContent = moment().format('dddd');
	update_counts(JSON.parse(document.body.getAttribute('data-chart')));

	from_now_el = document.querySelector('.from-now-time');

	if (document.body.dataset && document.body.dataset.nextrefresh) {
		next_time = moment(new Date(document.body.dataset.nextrefresh));

		setTimeout(function() {
			window.location.reload();
		}, next_time.diff(now) + 1500);

		setInterval(function() {
			from_now_el.textContent = next_time.fromNow();
		}, 200);

	}

});