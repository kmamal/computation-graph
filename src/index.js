const getId = (x) => x.id

class ComputationGraph {
	constructor (defineGraph) {
		this._nodes = new Map()
		this._computations = []
		this._values = Object.create(null)
		this._lags = []

		const nodeTypes = defineNodeTypes(this)
		this._result = defineGraph(nodeTypes)
	}

	compute (values) {
		if (this._lags.length > 0) {
			this._lags.shift()
			this._lags.push({ ...this._values })
		}

		Object.assign(this._values, values)
		for (const computation of this._computations) { computation() }

		return this._result
	}
}

const defineNodeTypes = (system) => {
	const nodeTypes = Object.create(null)

	class Node {
		constructor (id) {
			this.id = id
			system._nodes.set(id, this)
		}

		get () { return system._values[this.id] }
	}

	nodeTypes.variable = (...args) => new Node(...args)


	class Computed extends Node {
		constructor (id, fn) {
			const existing = system._nodes.get(id)
			if (existing) { return existing }

			super(id)
			system._computations.push(() => {
				system._values[this.id] = fn()
			})
		}
	}

	nodeTypes.add = (...sources) => new Computed(
		`add(${sources.map(getId).join(',')})`,
		() => sources.reduce((a, b) => a + b.get(), 0),
	)

	nodeTypes.sub = (a, b) => new Computed(
		`sub(${a.id},${b.id})`,
		() => a.get() - b.get(),
	)

	nodeTypes.mul = (...sources) => new Computed(
		`mul(${sources.map(getId).join(',')})`,
		() => sources.reduce((a, b) => a * b.get(), 1),
	)

	nodeTypes.div = (a, b) => new Computed(
		`div(${a.id},${b.id})`,
		() => a.get() / b.get(),
	)

	nodeTypes.min = (sources) => new Computed(
		`min(${sources.map(getId).join(',')})`,
		() => sources.reduce((a, b) => Math.min(a, b.get()), Infinity),
	)

	nodeTypes.max = (sources) => new Computed(
		`max(${sources.map(getId).join(',')})`,
		() => sources.reduce((a, b) => Math.max(a, b.get()), -Infinity),
	)

	nodeTypes.average = (...sources) => {
		const sum = nodeTypes.add(...sources)
		return new Computed(
			`average(${sources.map(getId).join(',')})`,
			() => sum.get() / sources.length,
		)
	}

	nodeTypes.abs = (source) => new Computed(
		`abs(${source.id})`,
		() => Math.abs(source.get()),
	)


	nodeTypes.lag = (source, steps) => {
		const numMissing = Math.max(0, steps - system._lags.length)
		for (let i = 0; i < numMissing; i++) { system._lags.push(Object.create(null)) }

		return new Computed(
			`lag(${source.id}, ${steps})`,
			() => system._lags.at(-steps)[source.id] ?? NaN,
		)
	}

	nodeTypes.initial = (source) => {
		let value = null
		return new Computed(
			`initial(${source.id})`,
			() => {
				const x = source.get()
				if (Number.isNaN(x)) { return NaN }

				return (value ??= x)
			},
		)
	}

	nodeTypes.count = (source) => {
		let value = 0
		return new Computed(
			`count(${source.id})`,
			() => {
				const x = source.get()
				if (Number.isNaN(x)) { return NaN }

				return ++value
			},
		)
	}


	nodeTypes.top = (source) => {
		let value = -Infinity
		return new Computed(
			`top(${source.id})`,
			() => {
				const x = source.get()
				if (Number.isNaN(x)) { return NaN }

				return (value = Math.max(value, x))
			},
		)
	}

	nodeTypes.bottom = (source) => {
		let value = Infinity
		return new Computed(
			`bottom(${source.id})`,
			() => {
				const x = source.get()
				if (Number.isNaN(x)) { return NaN }

				return (value = Math.min(value, x))
			},
		)
	}

	nodeTypes.square = (source) => nodeTypes.mul(source, source)

	nodeTypes.sqrt = (source) => new Computed(
		`sqrt(${source.id})`,
		() => Math.sqrt(source.get()),
	)

	nodeTypes.log = (source) => new Computed(
		`log(${source.id})`,
		() => Math.log(source.get()),
	)

	nodeTypes.inverse = (source) => new Computed(
		`inverse(${source.id})`,
		() => 1 / source.get(),
	)

	nodeTypes.sum = (source) => {
		let value = 0
		return new Computed(
			`sum(${source.id})`,
			() => {
				const x = source.get()
				if (Number.isNaN(x)) { return NaN }

				return (value += x)
			},
		)
	}

	nodeTypes.diff = (source) => {
		const prev = nodeTypes.lag(source, 1)
		return nodeTypes.sub(source, prev)
	}

	nodeTypes.product = (source) => {
		let value = 1
		return new Computed(
			`product(${source.id})`,
			() => {
				const x = source.get()
				if (Number.isNaN(x)) { return NaN }

				return (value *= x)
			},
		)
	}

	nodeTypes.growth = (source) => {
		const prev = nodeTypes.lag(source, 1)
		return nodeTypes.div(source, prev)
	}

	nodeTypes.mean = (source) => {
		const sum = nodeTypes.sum(source)
		const count = nodeTypes.count(sum)
		return nodeTypes.div(sum, count)
	}

	nodeTypes.harmonicMean = (source) => {
		const inv = nodeTypes.inverse(source)
		const meanInv = nodeTypes.mean(inv)
		return nodeTypes.inverse(meanInv)
	}

	nodeTypes.variance = (source) => {
		const meanSq = nodeTypes.mean(nodeTypes.square(source))
		const sqMean = nodeTypes.square(nodeTypes.mean(source))
		return nodeTypes.abs(nodeTypes.sub(meanSq, sqMean))
	}

	nodeTypes.standardDeviation = (source) => {
		const variance = nodeTypes.variance(source)
		return nodeTypes.sqrt(variance)
	}

	nodeTypes.coefficientOfVariation = (source) => {
		const stdDev = nodeTypes.standardDeviation(source)
		const mean = nodeTypes.mean(source)
		return nodeTypes.div(stdDev, nodeTypes.abs(mean))
	}

	nodeTypes.meanSquaredError = (a, b) => {
		const diff = nodeTypes.sub(a, b)
		const sqDiff = nodeTypes.square(diff)
		return nodeTypes.mean(sqDiff)
	}

	nodeTypes.drawdown = (source) => {
		const max = nodeTypes.top(source)
		const drawdown = nodeTypes.sub(max, source)
		return nodeTypes.div(drawdown, max)
	}

	nodeTypes.drawdownDuration = (source) => {
		let value = 0
		const trigger = nodeTypes.diff(nodeTypes.top(source))
		return new Computed(
			`drawdownDuration(${source.id})`,
			() => {
				const x = trigger.get()
				if (Number.isNaN(x)) { return NaN }

				return x > 0 ? (value = 0) : ++value
			},
		)
	}

	nodeTypes.payoff = (source) => new Computed(
		`payoff(${source.id})`,
		() => {
			const x = source.get()
			if (Number.isNaN(x)) { return NaN }

			return x >= 1 ? x - 1 : 1 - (1 / x)
		},
	)

	nodeTypes.sharpeRatio = (source) => {
		const payoff = nodeTypes.payoff(nodeTypes.growth(source))
		const mean = nodeTypes.mean(payoff)
		const stdDev = nodeTypes.standardDeviation(payoff)
		return nodeTypes.div(mean, stdDev)
	}

	nodeTypes.sharpeRatio2 = (a, b) => {
		const payoffA = nodeTypes.payoff(nodeTypes.growth(a))
		const payoffB = nodeTypes.payoff(nodeTypes.growth(b))
		const payoff = nodeTypes.sub(payoffA, payoffB)
		const mean = nodeTypes.mean(payoff)
		const stdDev = nodeTypes.standardDeviation(payoff)
		return nodeTypes.div(mean, stdDev)
	}

	nodeTypes.riskReturnRatio = (source) => {
		const payoff = nodeTypes.payoff(nodeTypes.growth(source))
		const mean = nodeTypes.mean(payoff)
		const maxDrawdown = nodeTypes.top(nodeTypes.drawdown(source))
		return nodeTypes.div(mean, maxDrawdown)
	}

	nodeTypes.modigliani = (a, b) => {
		const sharpe = nodeTypes.sharpeRatio2(a, b)
		const payoffB = nodeTypes.payoff(nodeTypes.growth(b))
		const stdDevB = nodeTypes.standardDeviation(payoffB)
		const meanB = nodeTypes.mean(payoffB)
		return nodeTypes.add(nodeTypes.mul(sharpe, stdDevB), meanB)
	}

	return nodeTypes
}

module.exports = { ComputationGraph }
