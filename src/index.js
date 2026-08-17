
class ComputationGraph {
	static ALL_NODES = [
		require('./nodes/logic'),
		require('./nodes/math'),
		require('./nodes/statistics'),
		require('./nodes/finance/from-price'),
		require('./nodes/finance/from-candle'),
		require('./nodes/moving-averages'),
	]

	constructor (...args) {
		this._nodes = new Map()
		this._computations = []
		this._values = Object.create(null)
		this._states = Object.create(null)
		this._lags = []

		const defineGraph = args.pop()
		const nodeTypes = Object.create(null)
		defineBasicNodeTypes(nodeTypes, this)
		for (const defineNodeTypes of args) {
			defineNodeTypes(nodeTypes, this)
		}
		this._result = defineGraph(nodeTypes)
	}

	compute (values) {
		if (this._lags.length > 0) {
			this._lags.shift()
			const clone = Object.assign(Object.create(null), this._values)
			this._lags.push(clone)
		}

		Object.assign(this._values, values)
		for (const computation of this._computations) { computation() }

		return this._result
	}

	stateToString () {
		return JSON.stringify({
			values: this._values,
			states: this._states,
			lags: this._lags,
		})
	}

	stateFromString (str) {
		const { values, states, lags } = JSON.parse(str)
		Object.assign(this._values, values)
		Object.assign(this._states, states)
		this._lags.length = 0
		this._lags.push(...lags.map((lag) => Object.assign(Object.create(null), lag)))
	}
}

const defineBasicNodeTypes = (n, graph) => {
	class Node {
		constructor (id) {
			this.id = id
			graph._nodes.set(id, this)
			this.set(NaN)
		}

		get () { return graph._values[this.id] }
		set (value) { graph._values[this.id] = value }
	}

	n.variable = (id) => new Node(id)


	class Computed extends Node {
		constructor (id, fn, state) {
			const existing = graph._nodes.get(id)
			if (existing) { return existing }

			super(id)

			graph._computations.push(() => { this.set(fn(state)) })
			if (state) { graph._states[this.id] = state }
		}
	}

	n.computed = (id, fn, state) => new Computed(id, fn, state)


	n.lag = (source, steps) => {
		if (steps === 0) { return source }

		const numMissing = Math.max(0, steps - graph._lags.length)
		for (let i = 0; i < numMissing; i++) { graph._lags.push(Object.create(null)) }

		return n.computed(
			`lag(${source.id}, ${steps})`,
			() => graph._lags.at(-steps)[source.id] ?? NaN,
		)
	}
}

module.exports = { ComputationGraph }
