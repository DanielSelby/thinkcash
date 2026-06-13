import Link from 'next/link'
import { Target, TrendingUp, Shield, BarChart3, PiggyBank, Zap, ArrowRight, Check } from 'lucide-react'

export default function LandingPage() {
  const features = [
    { icon: TrendingUp, title: 'Income & Expense Tracking', description: 'Log every transaction with categories, payment methods, and notes. Get a complete picture of your money flow.' },
    { icon: BarChart3, title: 'Smart Budgeting', description: 'Set monthly limits per category and get visual alerts before you overspend. Stay in control automatically.' },
    { icon: PiggyBank, title: 'Savings Goals', description: 'Create targets for emergency funds, vacations, or big purchases. Track progress and celebrate milestones.' },
    { icon: Zap, title: 'Financial Insights', description: 'AI-powered analysis spots spending trends, suggests savings opportunities, and tracks your financial health score.' },
    { icon: BarChart3, title: 'Reports & Exports', description: 'Generate monthly, quarterly, or annual reports. Export to PDF, Excel, or CSV in one click.' },
    { icon: Shield, title: 'Bank-grade Security', description: 'Row-level security ensures your data is only ever visible to you. Encrypted at rest and in transit.' },
  ]

  const plans = [
    {
      name: 'Free',
      price: '0',
      description: 'Perfect for getting started',
      features: ['Up to 100 transactions/month', '3 budget categories', '2 savings goals', 'CSV export', 'Email support'],
      cta: 'Get Started Free',
      href: '/auth/register',
      highlighted: false,
    },
    {
      name: 'Pro',
      price: '29',
      description: 'For serious financial planning',
      features: ['Unlimited transactions', 'Unlimited budgets & goals', 'PDF & Excel exports', 'Recurring transactions', 'Priority support', 'Financial health score'],
      cta: 'Start Free Trial',
      href: '/auth/register',
      highlighted: true,
    },
  ]

  return (
    <div className="min-h-screen bg-background">
      {/* Navbar */}
      <nav className="border-b border-border bg-card/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
              <Target className="w-4 h-4 text-primary-foreground" />
            </div>
            <span className="font-display font-bold text-lg gradient-text">Think-Shika Personal Account</span>
          </div>
          <div className="hidden md:flex items-center gap-6 text-sm">
            <Link href="#features" className="text-muted-foreground hover:text-foreground transition-colors">Features</Link>
            <Link href="#pricing" className="text-muted-foreground hover:text-foreground transition-colors">Pricing</Link>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/auth/login" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">Log in</Link>
            <Link href="/auth/register" className="inline-flex items-center gap-1.5 bg-primary text-primary-foreground text-sm font-medium px-4 py-2 rounded-lg hover:bg-primary/90 transition-colors shadow-sm">
              Get Started <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="max-w-6xl mx-auto px-6 py-24 text-center relative">
        <div className="absolute inset-0 bg-gradient-mesh pointer-events-none" />
        <div className="relative">
          <div className="inline-flex items-center gap-2 bg-primary/10 text-primary text-xs font-semibold px-3 py-1.5 rounded-full mb-6">
            <Zap className="w-3 h-3" /> Now with Financial Health Scoring
          </div>
          <h1 className="font-display text-5xl md:text-6xl font-bold leading-tight mb-6">
            Take control of your<br />
            <span className="gradient-text">financial future</span>
          </h1>
          <p className="text-muted-foreground text-xl max-w-2xl mx-auto mb-10 leading-relaxed">
            Track every cedi, set smart budgets, hit savings goals, and understand your money — all in one elegant dashboard built for Ghana and beyond.
          </p>
          <div className="flex items-center justify-center gap-4">
            <Link href="/auth/register" className="inline-flex items-center gap-2 bg-primary text-primary-foreground font-semibold px-6 py-3 rounded-xl hover:bg-primary/90 transition-all shadow-lg shadow-primary/20 text-base">
              Start for free <ArrowRight className="w-4 h-4" />
            </Link>
            <Link href="/auth/login" className="inline-flex items-center gap-2 bg-secondary text-secondary-foreground font-semibold px-6 py-3 rounded-xl hover:bg-secondary/80 transition-all text-base">
              Sign in
            </Link>
          </div>
          <p className="text-muted-foreground text-sm mt-4">No credit card required · Free forever plan</p>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="max-w-6xl mx-auto px-6 py-20">
        <div className="text-center mb-16">
          <h2 className="font-display text-3xl font-bold mb-4">Everything you need to manage money</h2>
          <p className="text-muted-foreground max-w-xl mx-auto">A complete personal finance toolkit built with modern design and powerful features.</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {features.map(({ icon: Icon, title, description }) => (
            <div key={title} className="glass-card rounded-2xl p-6 hover:shadow-md transition-shadow">
              <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center mb-4">
                <Icon className="w-5 h-5" />
              </div>
              <h3 className="font-display font-semibold mb-2">{title}</h3>
              <p className="text-muted-foreground text-sm leading-relaxed">{description}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="max-w-5xl mx-auto px-6 py-20">
        <div className="text-center mb-16">
          <h2 className="font-display text-3xl font-bold mb-4">Simple, transparent pricing</h2>
          <p className="text-muted-foreground">Start free. Upgrade when you need more.</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-3xl mx-auto">
          {plans.map(plan => (
            <div key={plan.name} className={`rounded-2xl p-8 border ${plan.highlighted ? 'border-primary bg-primary/5 shadow-lg shadow-primary/10 relative' : 'glass-card'}`}>
              {plan.highlighted && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-primary text-primary-foreground text-xs font-bold px-3 py-1 rounded-full">Most Popular</div>
              )}
              <h3 className="font-display text-xl font-bold">{plan.name}</h3>
              <p className="text-muted-foreground text-sm mb-4">{plan.description}</p>
              <div className="mb-6">
                <span className="font-display text-4xl font-bold">
                  {plan.price === '0' ? 'Free' : `GHS ${plan.price}`}
                </span>
                {plan.price !== '0' && <span className="text-muted-foreground">/month</span>}
              </div>
              <ul className="space-y-2.5 mb-8">
                {plan.features.map(f => (
                  <li key={f} className="flex items-center gap-2.5 text-sm">
                    <Check className="w-4 h-4 text-success flex-shrink-0" />
                    {f}
                  </li>
                ))}
              </ul>
              <Link
                href={plan.href}
                className={`w-full inline-flex items-center justify-center gap-2 py-2.5 rounded-xl font-semibold text-sm transition-all ${
                  plan.highlighted ? 'bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm' : 'border border-border bg-background hover:bg-secondary'
                }`}
              >
                {plan.cta} <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          ))}
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border py-12">
        <div className="max-w-6xl mx-auto px-6 flex flex-col md:flex-row items-center justify-between gap-4 text-sm text-muted-foreground">
          <div className="flex items-center gap-2">
            <Target className="w-4 h-4 text-primary" />
            <span className="font-display font-semibold text-foreground">Think-Shika Personal Account</span>
            <span>— Built for Africa</span>
          </div>
          <div className="flex gap-6">
            <Link href="/privacy" className="hover:text-foreground transition-colors">Privacy</Link>
            <Link href="/terms" className="hover:text-foreground transition-colors">Terms</Link>
            <Link href="/contact" className="hover:text-foreground transition-colors">Contact</Link>
          </div>
          <p>© {new Date().getFullYear()} Think-Shika Personal Account</p>
        </div>
      </footer>
    </div>
  )
}
