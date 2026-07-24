import { useState, useEffect } from "react";
import { Filter, RotateCcw } from "lucide-react";
import { GENRES, COUNTRIES, YEARS, SORTS } from "@/lib/constants";

export interface FilterState {
  category: string;
  country: string;
  year: string;
  sort_field: string;
  sort_type: string;
}

interface FilterBarProps {
  initialFilters: FilterState;
  onFilterChange: (filters: FilterState) => void;
  hideCategory?: boolean;
}

export default function FilterBar({ initialFilters, onFilterChange, hideCategory = false }: FilterBarProps) {
  const [tempFilters, setTempFilters] = useState<FilterState>(initialFilters);

  // Sync when initialFilters changes (e.g. from URL)
  useEffect(() => {
    setTempFilters(initialFilters);
  }, [initialFilters]);

  const handleApply = () => {
    onFilterChange(tempFilters);
  };

  const handleReset = () => {
    const defaultFilters = { category: "", country: "", year: "", sort_field: "modified.time", sort_type: "desc" };
    setTempFilters(defaultFilters);
    onFilterChange(defaultFilters);
  };

  const handleChange = (key: keyof FilterState, value: string) => {
    setTempFilters(prev => ({ ...prev, [key]: value }));
  };

  return (
    <div className="bg-[#121212] border border-white/5 rounded-2xl p-4 md:p-6 mb-8 md:mb-12 flex flex-col sm:flex-row flex-wrap items-start sm:items-end gap-4 shadow-xl">
      
      {!hideCategory && (
        <div className="flex flex-col gap-2 w-full sm:w-auto flex-1 min-w-[140px]">
          <label className="text-[#A0A0A0] text-xs font-medium uppercase">Thể loại</label>
          <select 
            value={tempFilters.category}
            onChange={(e) => handleChange('category', e.target.value)}
            className="bg-[#2A2A2A] text-white text-sm rounded-lg px-3 py-2.5 outline-none hover:bg-[#333] transition-colors w-full cursor-pointer"
          >
            <option value="">Tất cả thể loại</option>
            {GENRES.map(g => <option key={g.slug} value={g.slug}>{g.name}</option>)}
          </select>
        </div>
      )}

      <div className="flex flex-col gap-2 w-full sm:w-auto flex-1 min-w-[140px]">
        <label className="text-[#A0A0A0] text-xs font-medium uppercase">Quốc gia</label>
        <select 
          value={tempFilters.country}
          onChange={(e) => handleChange('country', e.target.value)}
          className="bg-[#2A2A2A] text-white text-sm rounded-lg px-3 py-2.5 outline-none hover:bg-[#333] transition-colors w-full cursor-pointer"
        >
          <option value="">Tất cả quốc gia</option>
          {COUNTRIES.map(c => <option key={c.slug} value={c.slug}>{c.name}</option>)}
        </select>
      </div>

      <div className="flex flex-col gap-2 w-full sm:w-auto flex-1 min-w-[120px]">
        <label className="text-[#A0A0A0] text-xs font-medium uppercase">Năm</label>
        <select 
          value={tempFilters.year}
          onChange={(e) => handleChange('year', e.target.value)}
          className="bg-[#2A2A2A] text-white text-sm rounded-lg px-3 py-2.5 outline-none hover:bg-[#333] transition-colors w-full cursor-pointer"
        >
          <option value="">Tất cả năm</option>
          {YEARS.map(y => <option key={y} value={y}>{y}</option>)}
        </select>
      </div>

      <div className="flex flex-col gap-2 w-full sm:w-auto flex-1 min-w-[160px]">
        <label className="text-[#A0A0A0] text-xs font-medium uppercase">Sắp xếp</label>
        <select 
          value={`${tempFilters.sort_field}-${tempFilters.sort_type}`}
          onChange={(e) => {
            const [field, type] = e.target.value.split('-');
            setTempFilters(prev => ({ ...prev, sort_field: field, sort_type: type }));
          }}
          className="bg-[#2A2A2A] text-white text-sm rounded-lg px-3 py-2.5 outline-none hover:bg-[#333] transition-colors w-full cursor-pointer"
        >
          {SORTS.map(s => <option key={`${s.field}-${s.type}`} value={`${s.field}-${s.type}`}>{s.name}</option>)}
        </select>
      </div>

      <div className="flex-grow hidden sm:block"></div>

      <div className="flex items-center gap-2 md:gap-3 w-full sm:w-auto mt-2 sm:mt-0">
        <button 
          onClick={handleApply}
          className="bg-[#E50914] hover:bg-[#b80710] text-white px-3 md:px-6 py-2.5 rounded-lg text-sm font-bold transition-all flex items-center justify-center gap-2 active:scale-95 flex-1 sm:flex-none"
        >
          <Filter className="w-4 h-4" /> Áp dụng
        </button>
        <button 
          onClick={handleReset}
          className="border border-white/20 hover:bg-white/10 text-white px-3 md:px-6 py-2.5 rounded-lg text-sm font-medium transition-all flex items-center justify-center gap-2 flex-1 sm:flex-none"
        >
          <RotateCcw className="w-4 h-4" /> Đặt lại
        </button>
      </div>
    </div>
  );
}
