module.exports = (n) => {
	n.payoff = (source) => n.computed(
		`payoff(${source.id})`,
		() => {
			const x = source.get()
			if (Number.isNaN(x)) { return NaN }

			return x >= 1 ? x - 1 : 1 - (1 / x)
		},
	)

	n.drawdown = (source) => {
		const max = n.top(source)
		const drawdown = n.sub(max, source)
		return n.div(drawdown, max)
	}

	n.drawdownDuration = (source) => {
		const trigger = n.diff(n.top(source))
		const duration = n.computed(
			`drawdownDuration(${source.id})`,
			() => {
				const x = trigger.get()
				if (Number.isNaN(x)) { return NaN }

				const value = duration.get() || 0
				return x > 0 ? 0 : value + 1
			},
		)
		return duration
	}

	n.sharpeRatio = (source) => {
		const payoff = n.payoff(n.growth(source))
		const mean = n.mean(payoff)
		const stdDev = n.standardDeviation(payoff)
		return n.div(mean, stdDev)
	}

	n.sharpeRatio2 = (a, b) => {
		const payoffA = n.payoff(n.growth(a))
		const payoffB = n.payoff(n.growth(b))
		const payoff = n.sub(payoffA, payoffB)
		const mean = n.mean(payoff)
		const stdDev = n.standardDeviation(payoff)
		return n.div(mean, stdDev)
	}

	n.riskReturnRatio = (source) => {
		const payoff = n.payoff(n.growth(source))
		const mean = n.mean(payoff)
		const maxDrawdown = n.top(n.drawdown(source))
		return n.div(mean, maxDrawdown)
	}

	n.modigliani = (a, b) => {
		const sharpe = n.sharpeRatio2(a, b)
		const payoffB = n.payoff(n.growth(b))
		const stdDevB = n.standardDeviation(payoffB)
		const meanB = n.mean(payoffB)
		return n.add(n.mul(sharpe, stdDevB), meanB)
	}

	n.relativeStrength = (source, fnAverage) => {
		const diff = n.diff(source)
		const gain = n.max(0, diff)
		const loss = n.max(0, n.neg(diff))
		const avgGain = fnAverage(gain)
		const avgLoss = fnAverage(loss)
		return n.if(n.eq(avgGain, avgLoss), 1, n.div(avgGain, avgLoss))
	}

	n.relativeStrengthIndex = (source, fnAverage) => {
		const rs = n.relativeStrength(source, fnAverage)
		return n.sub(100, n.div(100, n.add(rs, 1)))
	}

	n.trueStrengthIndex = (source, fnAverage1, fnAverage2) => {
		const momentum = n.diff(source)
		const absMomentum = n.abs(momentum)
		const avgMomentum = fnAverage2(fnAverage1(momentum))
		const avgAbsMomentum = fnAverage2(fnAverage1(absMomentum))
		return n.div(avgMomentum, avgAbsMomentum)
	}
}
