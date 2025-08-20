# LightVision

🌟 **A modern crypto dashboard and analytics platform**

[![Deployed on Vercel](https://img.shields.io/badge/Deployed%20on-Vercel-black?style=for-the-badge&logo=vercel)](https://vercel.com/)
[![Built with Next.js](https://img.shields.io/badge/Built%20with-Next.js-black?style=for-the-badge&logo=next.js)](https://nextjs.org/)

## 🚀 Overview

LightVision is a comprehensive crypto analytics platform that provides real-time insights into Total Value Locked (TVL), token metrics, and DeFi protocol data. Built with Next.js, TypeScript, and modern web technologies.

## ✨ Features

- 📊 **Real-time TVL Analytics** - Track Total Value Locked across protocols
- 💰 **Token Metrics** - Comprehensive token data and performance tracking
- 🔄 **DeFi Protocol Insights** - Monitor protocol performance and metrics
- 📱 **Responsive Design** - Mobile-first design with beautiful UI
- ⚡ **Fast Performance** - Optimized for speed and user experience
- 🌙 **Dark/Light Mode** - Theme switching support

## 🛠️ Tech Stack

- **Framework**: Next.js 15
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **UI Components**: Radix UI
- **Charts**: Recharts
- **Database**: Supabase
- **Deployment**: Vercel

## 🚀 Getting Started

### Prerequisites

- Node.js 18+ 
- pnpm (recommended) or npm

### Installation

1. Clone the repository:
```bash
git clone https://github.com/atareh/lightvision.git
cd lightvision
```

2. Install dependencies:
```bash
pnpm install
```

3. Set up environment variables:
```bash
cp .env.example .env.local
# Add your environment variables
```

4. Run the development server:
```bash
pnpm dev
```

5. Open [http://localhost:3000](http://localhost:3000) in your browser.

## 📁 Project Structure

```
lightvision/
├── app/                 # Next.js app directory
│   ├── api/            # API routes
│   ├── dashboard/      # Dashboard pages
│   └── layout.tsx      # Root layout
├── components/         # React components
│   ├── ui/            # UI components
│   └── charts/        # Chart components
├── hooks/             # Custom React hooks
├── lib/               # Utility functions
└── styles/            # Global styles
```

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- Built with inspiration from the DeFi ecosystem
- Thanks to the open-source community for amazing tools and libraries
