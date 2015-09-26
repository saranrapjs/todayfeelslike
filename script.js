function update_counts(data) {
	var width = parseInt(d3.select('.chart').style('width'), 10),
	    height = Math.min(400, width * 0.4),
	    radius = Math.min(width, height) / 2;

	var x = d3.scale.linear()
	    .range([0, width]);

	var arc = d3.svg.arc()
	    .outerRadius(radius * 0.8)
	    .innerRadius(0);

	var outerArc = d3.svg.arc()
		.innerRadius(radius * 0.9)
		.outerRadius(radius * 0.9);

	var pie = d3.layout.pie()
	    .sort(null)
	    .value(function(d) { return d.value; });

	var total = d3.sum(data, function(d) { 
		return d; 
	});

	var max = 0,
		maxIndex = 0;

	data.forEach(function(d, n) {
		if (d > max) {
			max = d;
			maxIndex = n;
		}
	});

	data = data.map(function(d, n) {
		var pct = Math.round((d / total) * 100);
		return {
			value: d,
			is_max: (n === maxIndex),
			pct: Math.round((d / total) * 100)
		};
	});

	var label_data = data.filter(function(d) {
		return d.pct > 1;
	});

	var svg = d3.select(".chart")
	    .attr("width", width)
	    .attr("height", height)
	  .append("g")
	    .attr("transform", "translate(" + width / 2 + "," + height / 2 + ")");

	svg.append("g")
		.attr("class", "slices");
	svg.append("g")
		.attr("class", "labels");
	svg.append("g")
		.attr("class", "lines");

	var slice = svg.select(".slices").selectAll("path.slice")
		.data(pie(data))
		.enter()
			.append("g")
			.attr("class", function(d,n) {
				var is_max = d.is_max ? ' is-max' : '';
				return "slice " + moment().day(n).format('dddd').toLowerCase() + is_max;
			});

	slice.append("path")
		.attr("d", arc)

	slice
		.append("text")
		.attr('class', 'numbers-label')
		.attr("transform", function(d) { return "translate(" + arc.centroid(d) + ")"; })
		.attr("dy", ".35em")
		.style("text-anchor", "middle")
		.text(function(d,n) {
			return Math.abs(d.startAngle - d.endAngle) > 0.1 ? d.value : '';
		});

	var text = svg.select(".labels").selectAll("text")
			.data(pie(label_data));

	function midAngle(d){
		return d.startAngle + (d.endAngle - d.startAngle)/2;
	}

	text.enter()
		.append("text")
		.attr("dy", ".35em")
		.text(function(d, n) {
			return moment().day(n).format('dddd') + ' (' + d.data.pct + '%)';
		})
		.attr('text-anchor', function(d) {
			return midAngle(d) < Math.PI ? "start":"end";
		})
		.attr('transform', function(d) {
			var pos = outerArc.centroid(d);
			pos[0] = radius * (midAngle(d) < Math.PI ? 1 : -1);
			return "translate("+ pos +")";
		})


	var polyline = svg.select(".lines").selectAll("polyline")
		.data(pie(label_data));

	polyline.enter()
		.append("polyline")
		.attr('class', 'lines')
		.attr('points', function(d) {
			var pos = outerArc.centroid(d);
			pos[0] = radius * 0.95 * (midAngle(d) < Math.PI ? 1 : -1);
			var innerpos = arc.centroid(d).map(function(pos) {
				return pos * 1.8;
			});
			return [innerpos, outerArc.centroid(d), pos];
		})
}

var next_time,
	from_now_el,
	now = moment();

window.addEventListener('load', function() {

	document.querySelector('.today').textContent = moment().format('dddd');
	update_counts(JSON.parse(document.body.getAttribute('data-chart')));

	from_now_el = document.querySelector('.from-now-time');

	if (document.body.dataset && document.body.dataset.nextrefresh) {
		next_time = moment(new Date(document.body.dataset.nextrefresh));

		if (next_time.diff(now) < -5000) {
			return;
		}

		setTimeout(function() {
			window.location.reload();
		}, next_time.diff(now) + 1500);

		setInterval(function() {
			from_now_el.textContent = next_time.fromNow();
		}, 200);

	}

});