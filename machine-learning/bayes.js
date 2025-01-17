
// These words occur in the english language with enough frequency that they are considered noise.
// They will be removed from text that is considered. The web site I found this list on claims that these 100 words
// occur with enough frequency to constitute 1/3 of typical english texts.
const COMMON_WORDS = ("the of an a to in is you that it he was for on are as with his they I "
					+ "at be this have from or one had by word but not what all were we when your can said "
					+ "there use an each which she do how their if will up other about out many then them these so "
					+ "some her would make like him into time has look two more write go see number no way could people "
					+ "my than first ZZwater been call who ZZoil its now find long down day did get come made may part "
					+ "this and").split(" ")

// punctuation I want stripped from all text. I'm taking the easy road at this point and assuming everything I come
// across will be 7-bit ascii.
const SYMBOLS = "!@#$%^&*()-+_=[]{}\\|;':\",.<>/?~`"

const VERY_UNLIKELY = 0.0000000001

// There are two ways to compute joint probability. The easy way is to use the product of individual probabilities.
// The problem with this approach is that for large texts, probability tends towards extremely small values (think of
// 0.01 * 0.01 * 0.01.  The solution is to use the sum of the logarithms of the probabilities.  No chance of underflow,
// but it has the disadvange of making the normalization that takes place at the end of all class calculations kind of
// hairy and unintuitive.
const USE_LOGS = true

function Bayes() {}

Bayes.prototype =
{
	constructor: Bayes,

	// these next two structures are related to each other and simplify lookups when computing probabilities.

	// stores information relating to how many times a word has recieved a specific classification.
	words: {},
	// stores information relating to how many times a classification has been assigned to a specific word.
	classes: {__length:0},

	// ensure that there are no null entries for a given word or class.
	sanitize: function(wrd, cls)
	{
		if (wrd != null)
		{
			if (typeof(this.words[wrd]) == "undefined") 		{this.words[wrd] = {__length:0}}
			if (typeof(this.words[wrd][cls]) == "undefined") 	{this.words[wrd][cls] = 0}
		}

		if (typeof(this.classes[cls]) == "undefined") 		{this.classes[cls] = {__length:0}}
		if (typeof(this.classes[cls][wrd]) == "undefined") 	{this.classes[cls][wrd] = 0.01}
	},

	// learn a word. This is where the statisical information is noted.
	teach: function(wrd, cls)
	{
		this.sanitize(wrd, cls)
		this.words[wrd][cls]++
		this.words[wrd].__length++
		this.classes[cls][wrd]++
		this.classes[cls].__length++
		this.classes.__length++
	},

	// p(C|D). Take a set of unseen words and compute a probibility that the document belongs to the supplied class.
	probabilityOfClassGivenDocument: function(cls, tokens)
	{
		var prob = 1
		if (USE_LOGS) prob = 0
		for (var i in tokens)
		{
			var p = this.probabilityOfWordGivenClass(tokens[i], cls)
			if (USE_LOGS)
			{
				prob += Math.log(p)
			}
			else
			{
				prob *= p
			}
		}
		if (USE_LOGS)
		{
			prob += Math.log(this.probabilityOfClass(cls))
		}
		else
		{
			prob *= this.probabilityOfClass(cls)
		}
		return prob
	},

	// p(C)
	probabilityOfClass: function(cls)
	{
		this.sanitize(null, cls)
		var pc = this.classes[cls].__length / this.classes.__length
		return pc
	},

	// condtional probability. p(w|C).  probability a give word is classified as cls. uses empirical data.
	probabilityOfWordGivenClass: function(wrd, cls)
	{
		this.sanitize(wrd, cls)
		var prob = this.words[wrd][cls] / this.classes[cls].__length
		// if a word has not been classified, don't use zero as the probability. It results in divide-by-zero later on.
		// instead, set it to an infinitesimal value indicating is very low probability. This skews the results, but not
		// too much.  This has the unfortunate side effect of introducing bogus probabilities when all tokens in a document
		// have never been seen before. This unlikely event is handled later on when probabilities for all classes are
		// examined and ordered.
		if (prob == 0) {return VERY_UNLIKELY;} // infinitesimal probability.
		else {return prob}
	}
}

var bayes = new Bayes()

// grabs text from a certain field and classifies it.
function guess(index)
{
	var doc = document.getElementById("ta" + index).value
	var tokens = scrub(doc)
	var probs = new Array()
	var probSum = 0
	for (var cls in bayes.classes)
	{
		if (cls == "__length") continue
		var prob = bayes.probabilityOfClassGivenDocument(cls, tokens)
		probSum += prob
		probs[probs.length] =
		{
			classification: cls,
			probability: prob,
			pc: bayes.probabilityOfClass(cls)
		}
	}
	// normalize
	// the log normalization conversion took me quite a bit of googling to figure out.  I'm still not sure how
	// accurate the math is.  Probabilities are adding up to 1 though, so I must be nearly right.
	var matchesPc = true
	for (var i = 0; i < probs.length; i++)
	{
		if (USE_LOGS)
		{
			probs[i].probability = 1 / (1 + Math.pow(Math.E, probSum-(2*probs[i].probability)))
		}
		else if (probSum > 0)
		{
			probs[i].probability = probs[i].probability / probSum
		}
		// in really bad cases, we may be given a text containing tokens that have never been seen before for any
		// classification.  In that cases, bayes craps out (because of the unseen seed value producing a very unlikely
		// probability) and returns a probability distribution that matches almost exactly the probability distribution of
		// p(C).  Recognize this bad case and shunt all probabilities to zero where they belong.
		var ratio = probs[i].probability / probs[i].pc
		if (ratio < 0.95 || ratio > 1.05)
		{
			matchesPc = false
		}
	}

	// maybe convert all (bogus) probabilities to zero.
	if (matchesPc)
	{
		for (var i = 0; i < probs.length; i++)
		{
			probs[i].probability = 0
		}
	}

	// sort them highest first.
	probs.sort(function(a, b)
	{
		return b.probability - a.probability
	})
	// convert to a pretty string.
	var str = ""
	for (var i = 0; i < probs.length; i++)
	{
		str += probs[i].classification + "(" + probs[i].probability + "),"
	}
	return str
}

// teach the bayes engine.
function teachAs(cls, index)
{
	var doc = document.getElementById("ta" + index).value
	var tokens = scrub(doc)
	for (var i in tokens)
	{
		bayes.teach(tokens[i], cls)
	}
}

// converts to lower case, removes punctuation and common words, converts to array.
function scrub(doc)
{
	// remove common words.
	function strip_common_words(tokens)
	{
		var newTokens = new Array()
		var ntPos = 0
		for (var i = 0; i < tokens.length; i++)
		{
			var common = false
			for (var cw = 0; cw < COMMON_WORDS.length; cw++)
			{
				if (COMMON_WORDS[cw] == tokens[i])
				{
					common = true
					break
				}
			}
			if (!common)
			{
				newTokens[ntPos++] = tokens[i]
			}
		}
		return newTokens
	}

	// strip out punctuation.
	function strip_non_chars(content)
	{
		var res = new String("")
		for (var i in content)
		{
			if (SYMBOLS.indexOf(content.charAt(i)) < 0)
			{
				res += content[i]
			}
		}
		return res
	}

	var putty = new String(doc)
	putty = putty.toLowerCase()
	putty = strip_non_chars(putty) // remove punctuation, etc.
	putty = putty.replace(/\s+/g,' ') // replace white space runs with a single 0x20.
	var tokens = putty.split(" ")
	tokens = strip_common_words(tokens)
	return tokens
}

