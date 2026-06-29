const AdSenseSlot = ({
  slot,
  format = 'auto',
  className = ''
}) => {
  const publisherId = import.meta.env.VITE_ADSENSE_PUBLISHER_ID;

  if (!publisherId || !slot) return null;

  return (
    <div className={`adsense-slot ${className}`}>
      <p className="mb-1 text-xs text-[#888880]">
        Advertisement
      </p>
      <ins
        className="adsbygoogle"
        style={{ display: 'block' }}
        data-ad-client={publisherId}
        data-ad-slot={slot}
        data-ad-format={format}
        data-full-width-responsive="true"
      />
    </div>
  );
};

export default AdSenseSlot;
