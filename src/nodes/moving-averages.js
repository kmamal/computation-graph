module.exports = (n) => {
	n.movingSum = (source, size) => {
		const last = n.lag(source, size - 1)
		return n.computed(
			`movingSum(${source.id},${size})`,
			(state) => {
				const x = source.get()
				if (Number.isNaN(x)) { return NaN }

				state.sum += x

				const y = last.get()
				if (Number.isNaN(y)) { return NaN }

				const result = state.sum
				state.sum -= y
				return result
			},
			{ sum: 0 },
		)
	}

	n.movingAverage = (source, size) => n.div(n.movingSum(source, size), size)

	n.weightedMovingAverage = (source, weight, size) => {
		const lastX = n.lag(source, size - 1)
		const lastW = n.lag(weight, size - 1)

		return n.computed(
			`weightedMovingAverage(${source.id},${weight.id},${size})`,
			(state) => {
				const x = source.get()
				const w = weight.get()
				if (Number.isNaN(x) || Number.isNaN(w)) { return NaN }

				state.sumX += x * w
				state.sumW += w

				const y = lastX.get()
				const v = lastW.get()
				if (Number.isNaN(y) || Number.isNaN(v)) { return NaN }

				const result = state.sumX / state.sumW
				state.sumX -= y * v
				state.sumW -= v
				return result
			},
			{ sumX: 0, sumW: 0 },
		)
	}

	n.movingVariance = (source, size) => {
		const meanSq = n.movingAverage(n.square(source), size)
		const sqMean = n.square(n.movingAverage(source, size))
		return n.max(0, n.sub(meanSq, sqMean))
	}

	n.movingStandardDeviation = (source, size) =>
		n.sqrt(n.movingVariance(source, size))

	n.movingMax = (source, size) => n.computed(
		`movingMax(${source.id},${size})`,
		(state) => {
			const x = source.get()
			if (Number.isNaN(x)) { return NaN }

			state.index++
			const { deque } = state
			while (deque.length > 0 && deque.at(-1)[1] <= x) { deque.pop() }
			deque.push([ state.index, x ])
			if (deque[0][0] <= state.index - size) { deque.shift() }

			return state.index < size - 1 ? NaN : deque[0][1]
		},
		{ deque: [], index: -1 },
	)

	n.movingMin = (source, size) => n.computed(
		`movingMin(${source.id},${size})`,
		(state) => {
			const x = source.get()
			if (Number.isNaN(x)) { return NaN }

			state.index++
			const { deque } = state
			while (deque.length > 0 && deque.at(-1)[1] >= x) { deque.pop() }
			deque.push([ state.index, x ])
			if (deque[0][0] <= state.index - size) { deque.shift() }

			return state.index < size - 1 ? NaN : deque[0][1]
		},
		{ deque: [], index: -1 },
	)

	n.exponentialMovingAverage = (source, alpha) => {
		const ema = n.computed(
			`exponentialMovingAverage(${source.id},${alpha})`,
			() => {
				const x = source.get()
				if (Number.isNaN(x)) { return NaN }

				const value = ema.get()
				return Number.isNaN(value) ? x : alpha * x + (1 - alpha) * value
			},
		)
		return ema
	}

	n.kaufmanAdaptiveMovingAverage = (source, size, fastSize, slowSize) => {
		const change = n.abs(n.sub(source, n.lag(source, size)))
		const volatility = n.movingSum(n.abs(n.diff(source)), size)
		const fastSC = 2 / (fastSize + 1)
		const slowSC = 2 / (slowSize + 1)
		const kama = n.computed(
			`kaufmanAdaptiveMovingAverage(${source.id},${size},${fastSize},${slowSize})`,
			() => {
				const x = source.get()
				if (Number.isNaN(x)) { return NaN }

				const changeVal = change.get()
				const volatilityVal = volatility.get()
				if (Number.isNaN(changeVal) || Number.isNaN(volatilityVal)) { return NaN }

				const value = kama.get()
				if (Number.isNaN(value)) { return x }

				const efficiencyRatio = volatilityVal > 0 ? changeVal / volatilityVal : 0
				const smoothing = (efficiencyRatio * (fastSC - slowSC) + slowSC) ** 2
				return value + smoothing * (x - value)
			},
		)
		return kama
	}
}
