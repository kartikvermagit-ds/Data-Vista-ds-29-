import React from 'react';

const developers = [
  {
    name: "Kartikey Pandey",
    role: "Ideas through AI and work on AI models",
    image: "/1.png"
  },
  {
    name: "Krishna Kumar",
    role: "Frontend / UI UX, Special Golden Styling",
    image: "/2.png"
  },
  {
    name: "Kartik Verma",
    role: "Git, Database/Backend, Forest(Prompts)",
    image: "/3.png"
  },
  {
    name: "Gyan Aryan",
    role: "Data Handling",
    image: "/4.png"
  }
];

export function DevelopersFooter() {
  return (
    <footer className="mt-12 pt-8 border-t border-[#C0A062]/10">
      <div className="flex flex-col items-center gap-6">
        <p className="text-xs uppercase tracking-[0.3em] text-slate-500 dark:text-[#8F856F] font-medium">
          Architected & Developed by
        </p>
        
        <div className="flex flex-wrap justify-center gap-8 md:gap-12">
          {developers.map((dev, i) => (
            <div key={i} className="group flex flex-col items-center text-center transition-all duration-300 hover:scale-105">
              <div className="relative mb-3">
                <div className="absolute -inset-1 rounded-full bg-gradient-to-tr from-[#C0A062] to-[#E7D19A] opacity-0 group-hover:opacity-100 blur transition duration-500"></div>
                <div className="relative h-16 w-16 overflow-hidden rounded-full border-2 border-[#C0A062]/30 bg-slate-900/50 backdrop-blur-sm">
                  <img 
                    src={dev.image} 
                    alt={dev.name} 
                    className="h-full w-full object-cover grayscale group-hover:grayscale-0 transition-all duration-500"
                    onError={(e) => {
                      (e.target as HTMLImageElement).src = `https://ui-avatars.com/api/?name=${encodeURIComponent(dev.name)}&background=16120B&color=C0A062&bold=true`;
                    }}
                  />
                </div>
              </div>
              <div>
                <h4 className="text-sm font-semibold text-slate-900 dark:text-[#F5F0E6] group-hover:text-[#C0A062] transition-colors">
                  {dev.name}
                </h4>
                <p className="mt-1 max-w-[150px] text-[10px] leading-tight text-slate-500 dark:text-[#A7A093] opacity-80 uppercase tracking-wider">
                  {dev.role}
                </p>
              </div>
            </div>
          ))}
        </div>
        
        <p className="mt-4 text-[10px] text-slate-500 dark:text-[#5F584C] tracking-widest uppercase">
          &copy; 2026 DataVista Intelligence. All Rights Reserved.
        </p>
      </div>
    </footer>
  );
}
