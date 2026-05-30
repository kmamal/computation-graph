const R = require('@kmamal/reactive')

const neverEqual = () => false
const getId = (x) => x.id()


class System {
	constructor () {
		this._reactive = R.makeRealm()
		this._atoms = new Map()

		defineClasses(this)

		this._subscriber = this._reactive.reaction(() => {
			for (const derived of this._atoms.values()) {
				derived.get()
			}
		})
	}

	beginUpdate () { this._reactive.graph.suspend() }
	endUpdate () { this._reactive.graph.resume() }

	start () { this._subscriber.subscribe() }
	stop () { this._subscriber.unsubscribe() }
}


const defineClasses = (system) => {
	class Constant {
		constructor (value) { this._value = value }
		id () { return this._value }
		get () { return this._value }
		peek () { return this._value }
	}

	system.constant = (...args) => new Constant(...args)

	class Atom {
		constructor (id) {
			this._id = id
			system._atoms.set(id, this)
		}

		id () { return this._id }
		get () { return this._value.get() }
		peek () { return this._value.peek() }
		set (x) { this._value.set(x) }
	}

	system.atom = (...args) => new Atom(...args)

	class Variable extends Atom {
		constructor (id) {
			super(id)
			this._value = system._reactive.value(null, neverEqual)
		}
	}

	system.variable = (...args) => new Variable(...args)

	class Derived extends Atom {
		constructor (id, ...sources) {
			const existing = system._atoms.get(id)
			if (existing) { return existing }

			super(id)

			const { length } = sources
			const values = new Array(length)
			const calc = () => {
				for (let i = 0; i < length; i++) {
					const value = sources[i].get()
					if (value === null) { return this.peek() }
					values[i] = value
				}
				return this._calc(...values)
			}
			this._value = system._reactive.computed(calc, null, neverEqual)
		}

		_calc (x) { return x }
	}

	system.derived = (...args) => new Derived(...args)

	class Calc extends Derived {
		constructor (...args) {
			const id = `calc(${args.map((x) => x.toString()).join(',')})`
			const fn = args.pop()
			super(id, ...args)
			this._fn = fn
		}

		_calc (...args) { return this._fn(...args) }
	}

	system.calc = (...args) => new Calc(...args)


	class Initial extends Derived {
		constructor (source) { super(`initial(${source.id()})`, source) }

		_calc (x) {
			const value = this.peek()
			if (value === null) { return x }
			return value
		}
	}

	system.initial = (...args) => new Initial(...args)


	class AddVars extends Derived {
		constructor (...sources) {
			super(`addVars(${sources.map(getId).join(',')})`, ...sources)
		}

		_calc (...values) { return values.reduce((a, b) => a + b, 0) }
	}

	system.addVars = (...args) => new AddVars(...args)

	class SubVars extends Derived {
		constructor (a, b) {
			super(`subVars(${a.id()},${b.id()})`, a, b)
		}

		_calc (a, b) { return a - b }
	}

	system.subVars = (...args) => new SubVars(...args)

	class MulVars extends Derived {
		constructor (...sources) {
			super(`mulVars(${sources.map(getId).join(',')})`, ...sources)
		}

		_calc (...values) { return values.reduce((a, b) => a * b, 1) }
	}

	system.mulVars = (...args) => new MulVars(...args)

	class DivVars extends Derived {
		constructor (a, b) {
			super(`divVars(${a.id()},${b.id()})`, a, b)
		}

		_calc (a, b) { return a / b }
	}

	system.divVars = (...args) => new DivVars(...args)

	class MinVars extends Derived {
		constructor (...sources) {
			super(`minVars(${sources.map(getId).join(',')})`, ...sources)
		}

		_calc (...values) {
			return values.reduce((a, b) => Math.min(a, b), Infinity)
		}
	}

	system.minVars = (...args) => new MinVars(...args)

	class MaxVars extends Derived {
		constructor (...sources) {
			super(`maxVars(${sources.map(getId).join(',')})`, ...sources)
		}

		_calc (...values) {
			return values.reduce((a, b) => Math.max(a, b), -Infinity)
		}
	}

	system.maxVars = (...args) => new MaxVars(...args)

	class AverageVars extends Derived {
		constructor (...sources) {
			super(`averageVars(${sources.map(getId).join(',')})`, new DivVars(
				new AddVars(...sources),
				new Constant(sources.length),
			))
		}
	}

	system.averageVars = (...args) => new AverageVars(...args)


	class Count extends Derived {
		constructor (source) {
			super(`count(${source.id()})`, source)
			this.set(0)
		}

		_calc () { return this.peek() + 1 }
	}

	system.count = (...args) => new Count(...args)

	class Delay extends Derived {
		constructor (source, steps) {
			const prevSource = steps === 1 ? source : new Delay(source, steps - 1)
			super(`delay(${source.id()}, ${steps})`, prevSource)
			this._prev = null
		}

		_calc (x) {
			const curr = this._prev
			this._prev = x
			return curr
		}
	}

	system.delay = (...args) => new Delay(...args)

	class Abs extends Derived {
		constructor (source) { super(`abs(${source.id()})`, source) }
		_calc (x) { return Math.abs(x) }
	}

	system.abs = (...args) => new Abs(...args)

	class Top extends Derived {
		constructor (source) {
			super(`top(${source.id()})`, source)
			this.set(-Infinity)
		}

		_calc (x) { return Math.max(this.peek(), x) }
	}

	system.top = (...args) => new Top(...args)

	class Bottom extends Derived {
		constructor (source) {
			super(`bottom(${source.id()})`, source)
			this.set(Infinity)
		}

		_calc (x) { return Math.min(this.peek(), x) }
	}

	system.bottom = (...args) => new Bottom(...args)

	class Square extends Derived {
		constructor (source) { super(`square(${source.id()})`, source) }
		_calc (x) { return x * x }
	}

	system.square = (...args) => new Square(...args)

	class Sqrt extends Derived {
		constructor (source) { super(`sqrt(${source.id()})`, source) }
		_calc (x) { return Math.sqrt(x) }
	}

	system.sqrt = (...args) => new Sqrt(...args)

	class Log extends Derived {
		constructor (source) { super(`log(${source.id()})`, source) }
		_calc (x) { return Math.log(x) }
	}

	system.log = (...args) => new Log(...args)

	class Inverse extends Derived {
		constructor (source) { super(`inverse(${source.id()})`, source) }
		_calc (x) { return 1 / x }
	}

	system.inverse = (...args) => new Inverse(...args)

	class Sum extends Derived {
		constructor (source) {
			super(`sum(${source.id()})`, source)
			this.set(0)
		}

		_calc (x) { return this.peek() + x }
	}

	system.sum = (...args) => new Sum(...args)

	class Diff extends Derived {
		constructor (source) {
			const x = new SubVars(source, new Delay(source, 1))
			super(`diff(${source.id()})`, x)
		}
	}

	system.diff = (...args) => new Diff(...args)

	class Product extends Derived {
		constructor (source) {
			super(`product(${source.id()})`, source)
			this.set(1)
		}

		_calc (x) { return this.peek() * x }
	}

	system.product = (...args) => new Product(...args)

	class Growth extends Derived {
		constructor (source) {
			const x = new DivVars(source, new Delay(source, 1))
			super(`growth(${source.id()})`, x)
		}
	}

	system.growth = (...args) => new Growth(...args)

	class Mean extends Derived {
		constructor (source) {
			const x = new DivVars(new Sum(source), new Count(source))
			super(`mean(${source.id()})`, x)
		}
	}

	system.mean = (...args) => new Mean(...args)

	class HarmonicMean extends Derived {
		constructor (source) {
			const x = new Inverse(new Mean(new Inverse(source)))
			super(`harmonicMean(${source.id()})`, x)
		}
	}

	system.harmonicMean = (...args) => new HarmonicMean(...args)

	class Variance extends Derived {
		constructor (source) {
			super(`variance(${source.id()})`, new SubVars(
				new Mean(new Square(source)),
				new Square(new Mean(source)),
			))
		}
	}

	system.variance = (...args) => new Variance(...args)

	class StandardDeviation extends Derived {
		constructor (source) {
			super(`standardDeviation(${source.id()})`, new Sqrt(new Variance(source)))
		}
	}

	system.standardDeviation = (...args) => new StandardDeviation(...args)

	class CoefficientOfVariation extends Derived {
		constructor (source) {
			const x = new DivVars(
				new StandardDeviation(source),
				new Abs(new Mean(source)),
			)
			super(`coefficientOfVariation(${source.id()})`, x)
		}
	}

	system.coefficientOfVariation = (...args) => new CoefficientOfVariation(...args)

	class MeanSquaredError extends Derived {
		constructor (a, b) {
			const x = new Mean(new Square(new SubVars(a, b)))
			super(`meanSquaredError(${a.id()},${b.id()})`, x)
		}
	}

	system.meanSquaredError = (...args) => new MeanSquaredError(...args)

	class Drawdown extends Derived {
		constructor (source) {
			const max = new Top(source)
			const x = new DivVars(new SubVars(max, source), max)
			super(`drawdown(${source.id()})`, x)
		}
	}

	system.drawdown = (...args) => new Drawdown(...args)

	class DrawdownDuration extends Derived {
		constructor (source) {
			const x = new Diff(new Top(source))
			super(`drawdownDuration(${source.id()})`, x)
			this.set(0)
		}

		_calc (x) { return x > 0 ? 0 : this.peek() + 1 }
	}

	system.drawdownDuration = (...args) => new DrawdownDuration(...args)

	class Payoff extends Derived {
		constructor (source) {
			super(`payoff(${source.id()})`, source)
		}

		_calc (x) {
			return x > 1 ? x - 1 : 1 - (1 / x)
		}
	}

	system.payoff = (...args) => new Payoff(...args)

	class SharpeRatio extends Derived {
		constructor (source) {
			const g = new Payoff(new Growth(source))
			const x = new DivVars(new Mean(g), new StandardDeviation(g))
			super(`sharpeRatio(${source.id()})`, x)
		}
	}

	system.sharpeRatio = (...args) => new SharpeRatio(...args)

	class SharpeRatio2 extends Derived {
		constructor (a, b) {
			const pga = new Payoff(new Growth(a))
			const pgb = new Payoff(new Growth(b))
			const g = new SubVars(pga, pgb)
			const x = new DivVars(new Mean(g), new StandardDeviation(g))
			super(`sharpeRatio2(${a.id()},${b.id()})`, x)
		}
	}

	system.sharpeRatio2 = (...args) => new SharpeRatio2(...args)

	class RiskReturnRatio extends Derived {
		constructor (source) {
			const g = new Payoff(new Growth(source))
			const x = new DivVars(new Mean(g), new Top(new Drawdown(source)))
			super(`riskReturnRatio(${source.id()})`, x)
		}
	}

	system.riskReturnRatio = (...args) => new RiskReturnRatio(...args)

	class Modigliani extends Derived {
		constructor (a, b) {
			const gb = new Payoff(new Growth(b))
			const x = new AddVars(
				new MulVars(
					new SharpeRatio2(a, b),
					new StandardDeviation(gb),
				), new Mean(gb),
			)
			super(`modigliani(${a.id()},${b.id()})`, x)
		}
	}

	system.modigliani = (...args) => new Modigliani(...args)
}

module.exports = { System }
