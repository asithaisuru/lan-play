const Spinner = ({ label = 'Loading' }) => (
  <div className="flex min-h-40 flex-col items-center justify-center gap-3 text-[#888880]">
    <div className="h-10 w-10 animate-spin rounded-full border-2 border-[#C9A84C22] border-t-[#C9A84C]" />
    <p className="text-sm">{label}</p>
  </div>
);

export default Spinner;
