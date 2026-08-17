module.exports = (n) => {
	n.range = (source) => {
		const high = n.price.high(source)
		const low = n.price.low(source)
		return n.computed(
			`range(${source.id})`,
			() => {
				const candle = source.get()
				if (Number.isNaN(candle)) { return NaN }

				return high.get() - low.get()
			},
		)
	}

	n.trueRange = (source) => {
		const high = n.price.high(source)
		const low = n.price.low(source)
		const close = n.price.close(source)
		const prevClose = n.lag(close, 1)
		return n.computed(
			`trueRange(${source.id})`,
			() => {
				const prevCloseValue = prevClose.get()
				if (Number.isNaN(prevCloseValue)) { return NaN }

				const trueHigh = Math.max(high.get(), prevCloseValue)
				const trueLow = Math.min(low.get(), prevCloseValue)
				return trueHigh - trueLow
			},
		)
	}

	n.positiveDirectionalIndicator = (source) => {
		const high = n.price.high(source)
		const low = n.price.low(source)
		const prevHigh = n.lag(high, 1)
		const prevLow = n.lag(low, 1)
		return n.computed(
			`positiveDirectionalIndicator(${source.id})`,
			() => {
				const prevHighValue = prevHigh.get()
				const prevLowValue = prevLow.get()
				if (Number.isNaN(prevHighValue) || Number.isNaN(prevLowValue)) { return NaN }

				const upMove = high.get() - prevHighValue
				const downMove = prevLowValue - low.get()
				return upMove > downMove && upMove > 0 ? upMove : 0
			},
		)
	}

	n.negativeDirectionalIndicator = (source) => {
		const high = n.price.high(source)
		const low = n.price.low(source)
		const prevHigh = n.lag(high, 1)
		const prevLow = n.lag(low, 1)
		return n.computed(
			`negativeDirectionalIndicator(${source.id})`,
			() => {
				const prevHighValue = prevHigh.get()
				const prevLowValue = prevLow.get()
				if (Number.isNaN(prevHighValue) || Number.isNaN(prevLowValue)) { return NaN }

				const upMove = high.get() - prevHighValue
				const downMove = prevLowValue - low.get()
				return downMove > upMove && downMove > 0 ? downMove : 0
			},
		)
	}

	n.directionalMovementIndex = (source, atr) => {
		const pdi = n.positiveDirectionalIndicator(source)
		const ndi = n.negativeDirectionalIndicator(source)
		return n.mul(100, n.div(n.sub(pdi, ndi), atr))
	}

	n.positiveDirectionalIndex = (source, alpha) => n.mul(100, n.div(
		n.exponentialMovingAverage(n.positiveDirectionalIndicator(source), alpha),
		n.exponentialMovingAverage(n.trueRange(source), alpha),
	))

	n.negativeDirectionalIndex = (source, alpha) => n.mul(100, n.div(
		n.exponentialMovingAverage(n.negativeDirectionalIndicator(source), alpha),
		n.exponentialMovingAverage(n.trueRange(source), alpha),
	))

	n.averageDirectionalIndex = (source, alpha) => {
		const pdi = n.positiveDirectionalIndex(source, alpha)
		const ndi = n.negativeDirectionalIndex(source, alpha)
		const dx = n.mul(100, n.div(n.abs(n.sub(pdi, ndi)), n.add(pdi, ndi)))
		return n.exponentialMovingAverage(dx, alpha)
	}

	n.supertrend = (source, multiplier, alpha) => {
		const high = n.price.high(source)
		const low = n.price.low(source)
		const close = n.price.close(source)
		const prevClose = n.lag(close, 1)
		const atr = n.exponentialMovingAverage(n.trueRange(source), alpha)
		const supertrend = n.computed(
			`supertrend(${source.id},${multiplier},${alpha})`,
			(state) => {
				const atrValue = atr.get()
				if (Number.isNaN(atrValue)) { return NaN }

				const closeValue = close.get()
				const mid = (high.get() + low.get()) / 2
				const basicUpper = mid + multiplier * atrValue
				const basicLower = mid - multiplier * atrValue

				if (state.isRising === null) {
					state.upper = basicUpper
					state.lower = basicLower
					state.isRising = closeValue >= mid
				}
				else {
					const prevCloseValue = prevClose.get()
					if (basicUpper < state.upper || prevCloseValue > state.upper) {
						state.upper = basicUpper
					}
					if (basicLower > state.lower || prevCloseValue < state.lower) {
						state.lower = basicLower
					}

					if (state.isRising) {
						if (closeValue < state.lower) { state.isRising = false }
					}
					else if (closeValue > state.upper) { state.isRising = true }
				}

				return state.isRising ? state.lower : state.upper
			},
			{ upper: null, lower: null, isRising: null },
		)
		return supertrend
	}

	n.parabolicSar = (source, a, aStep, aMax) => {
		const high = n.price.high(source)
		const low = n.price.low(source)
		const prevHigh = n.lag(high, 1)
		const prevLow = n.lag(low, 1)
		const sar = n.computed(
			`parabolicSar(${source.id}, ${a}, ${aStep}, ${aMax})`,
			(state) => {
				const prevHighValue = prevHigh.get()
				const prevLowValue = prevLow.get()
				if (Number.isNaN(prevHighValue) || Number.isNaN(prevLowValue)) { return NaN }

				const highValue = high.get()
				const lowValue = low.get()

				const sarValue = sar.get()
				if (Number.isNaN(sarValue)) {
					state.a = a
					state.isRising = highValue >= prevHighValue
					let initialSarValue
					if (state.isRising) {
						state.extremePoint = highValue
						initialSarValue = prevLowValue
					}
					else {
						state.extremePoint = lowValue
						initialSarValue = prevHighValue
					}
					return initialSarValue
				}

				let newSarValue = sarValue + state.a * (state.extremePoint - sarValue)

				if (state.isRising) {
					newSarValue = Math.min(newSarValue, prevLowValue)
					if (lowValue < newSarValue) {
						state.isRising = false
						newSarValue = state.extremePoint
						state.extremePoint = lowValue
						state.a = a
					}
					else if (highValue > state.extremePoint) {
						state.extremePoint = highValue
						state.a = Math.min(state.a + aStep, aMax)
					}
				}
				else {
					newSarValue = Math.max(newSarValue, prevHighValue)
					if (highValue > newSarValue) {
						state.isRising = true
						newSarValue = state.extremePoint
						state.extremePoint = highValue
						state.a = a
					}
					else if (lowValue < state.extremePoint) {
						state.extremePoint = lowValue
						state.a = Math.min(state.a + aStep, aMax)
					}
				}

				return newSarValue
			},
			{ isRising: null, extremePoint: null, a: null },
		)
		return sar
	}
}
