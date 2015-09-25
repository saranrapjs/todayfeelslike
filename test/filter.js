var filter = require('../filter.js');

// String.prototype.testFilter = function() {
// 	console.log(this.toString(), '/// day: ', filter(this.toString()));
// }

// "Yesterday's public holiday fucked with my mind so much. Yesterday, I thought today would be Sunday..and now it feels like a Saturday".testFilter();
// "Yesterday felt like Friday and today feels like Thursday day".testFilter();


var expect = require("chai").expect;
 
describe("tweet filter", function(){
 
	it("should ignore negative syntax", function() {
		var result = filter("Today feels nothing like a Friday");
		expect(result).to.equal(false);
	});

	it("should ignore other tenses", function() {
		expect(filter("yesterday felt like Friday... today feels like Monday day")).to.equal(1);
	});

	it("should only operate within a clause", function() {
		expect(filter("Today feels weird to me. It doesn't feel like any special day of the week. It doesn't feel like Friday. It'd just a day. day")).to.equal(false);
	});

	it("should be flexible about other syntaxes", function() {
		expect(filter("Today seriously feels like a Monday")).to.equal(1);
	})

	it("should be flexible about other syntaxes pt 2", function() {
		expect(filter("Am I the only one that feels like today's sunday..? I'm depressing myself for nothing day")).to.equal(0);
	});

});