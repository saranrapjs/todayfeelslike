var csv = require('csv'),
	moment = require('moment'),
	fs = require('fs'),
	date_format = 'MM-DD-YYYY',
	filename = 'sample.csv';

var weekdays = moment.weekdays();

function get_csv(filename, cb) {
	var sample = fs.createReadStream(filename),
		parser = csv.parse({ columns: true }),
		rows = [];
	parser.on('readable', function() {
		while(record = parser.read()){
			weekdays.forEach(function(day, n) {
				if (record[day]) {
					record[day] = parseInt(record[day]);
				} else {
					record[day] = 0;
				}
			});
			rows.push(record);
		}
	})
	parser.on('finish', function(data) {
		if (cb) cb(rows);
	})
	sample.pipe(parser);
}

function write_csv(rows) {
	var file = fs.createWriteStream(filename),
		stringifier = csv.stringify({ header: true });

	stringifier.pipe(file);

	// this is stupid
	rows.forEach(function(row) {
		stringifier.write(row);
	});
	stringifier.end();
}

function record_rows(rows, d) {
	d = d || moment();
	var data = {
		'Date': d.format(date_format),
		'Day of Week': d.format('dddd')
	};
	weekdays.forEach(function(day, n) {
		data[day] = rows[n]
	});

	write_row(data);
}

function get_current(d, cb) {
	var d = d || moment(),
		compare_date = d.format(date_format),
		found = false;
	get_csv(filename, function(the_csv) {
		the_csv.some(function(row) {
			if (row.Date === compare_date) {
				cb(row);
				return found = true;
			}
		});
		if (!found) cb(null);
	});	
}

function write_row(data) {
	var resulting_csv,
		row_found = false;
	get_csv(filename, function(the_csv) {
		resulting_csv = the_csv.map(function(row) {
			if (row.Date === data.Date) {
				row_found = true;
				return data;
			} else {
				return row;
			}
		});
		if (row_found === false) {
			resulting_csv.push(data);
		}
		write_csv(resulting_csv);
	});
}

module.exports = {
	record: record_rows,
	get_current: get_current,
	read: get_csv
};