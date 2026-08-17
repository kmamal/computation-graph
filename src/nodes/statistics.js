module.exports = (n) => {
	n.initial = (source) => {
		const initial = n.computed(
			`initial(${source.id})`,
			() => {
				const x = source.get()
				if (Number.isNaN(x)) { return NaN }

				const value = initial.get()
				return Number.isNaN(value) ? x : value
			},
		)
		return initial
	}

	n.count = (source) => {
		const count = n.computed(
			`count(${source.id})`,
			() => {
				const x = source.get()
				if (Number.isNaN(x)) { return NaN }

				const value = count.get()
				return Number.isNaN(value) ? 1 : value + 1
			},
		)
		return count
	}

	n.top = (source) => {
		const top = n.computed(
			`top(${source.id})`,
			() => {
				const x = source.get()
				if (Number.isNaN(x)) { return NaN }

				const value = top.get()
				return Number.isNaN(value) ? x : Math.max(value, x)
			},
		)
		return top
	}

	n.bottom = (source) => {
		const bottom = n.computed(
			`bottom(${source.id})`,
			() => {
				const x = source.get()
				if (Number.isNaN(x)) { return NaN }

				const value = bottom.get()
				return Number.isNaN(value) ? x : Math.min(value, x)
			},
		)
		return bottom
	}

	n.mean = (source) => {
		const sum = n.sum(source)
		const count = n.count(sum)
		return n.div(sum, count)
	}

	n.harmonicMean = (source) => {
		const inv = n.inverse(source)
		const meanInv = n.mean(inv)
		return n.inverse(meanInv)
	}

	n.variance = (source) => {
		const meanSq = n.mean(n.square(source))
		const sqMean = n.square(n.mean(source))
		return n.max(0, n.sub(meanSq, sqMean))
	}

	n.standardDeviation = (source) => {
		const variance = n.variance(source)
		return n.sqrt(variance)
	}

	n.coefficientOfVariation = (source) => {
		const stdDev = n.standardDeviation(source)
		const mean = n.mean(source)
		return n.div(stdDev, n.abs(mean))
	}

	n.meanSquaredError = (a, b) => {
		const diff = n.sub(a, b)
		const sqDiff = n.square(diff)
		return n.mean(sqDiff)
	}

	n.kalmanFilter = (source, processNoise, measurementNoise) => {
		const kalman = n.computed(
			`kalmanFilter(${source.id},${processNoise},${measurementNoise})`,
			(state) => {
				const z = source.get()
				if (Number.isNaN(z)) { return NaN }

				const value = kalman.get()
				if (Number.isNaN(value)) {
					state.p = measurementNoise
					return z
				}

				const p = state.p + processNoise
				const gain = p / (p + measurementNoise)
				state.p = (1 - gain) * p
				return value + gain * (z - value)
			},
			{ p: 0 },
		)
		return kalman
	}
}
