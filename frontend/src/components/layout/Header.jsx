import { Link, useNavigate } from 'react-router-dom';
import { LogOut } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

const Header = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const displayName = user?.name || user?.email || 'Host';

  const handleLogout = () => {
    logout(() => navigate('/login'));
  };

  return (
    <header className="border-b border-[rgba(201,168,76,0.15)] bg-[#141414]">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-4 md:px-6">
        <Link to="/" className="flex min-w-0 items-center gap-3">
          <img src="/waveio.svg" alt="Waveio" className="h-10 w-10 flex-shrink-0 rounded-lg" />
          <div className="min-w-0">
            <p className="truncate text-lg font-semibold tracking-[0.02em] text-[#F5F5F5]">Waveio</p>
            <p className="truncate text-xs uppercase text-[#888880]">A KRODOT Product</p>
          </div>
        </Link>

        <div className="flex flex-shrink-0 items-center gap-3">
          {user ? (
            <>
              {user.avatar ? (
                <img src={user.avatar} alt={displayName} className="h-9 w-9 rounded-full object-cover" />
              ) : (
                <div className="flex h-9 w-9 items-center justify-center rounded-full border border-[#C9A84C44] bg-[#1A1810] text-sm font-semibold text-[#C9A84C]">
                  {displayName.charAt(0).toUpperCase()}
                </div>
              )}
              <span className="hidden max-w-40 truncate text-sm font-medium text-[#F5F5F5] sm:inline">
                {displayName}
              </span>
              <button
                type="button"
                onClick={handleLogout}
                className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-[#C9A84C22] bg-[#0A0A0A] text-[#D0D0C8] transition hover:border-[#C9A84C66] hover:text-[#F5F5F5]"
                title="Log out"
                aria-label="Log out"
              >
                <LogOut size={17} />
              </button>
            </>
          ) : (
            <Link to="/login" className="btn btn-primary px-4 py-2">
              Login
            </Link>
          )}
        </div>
      </div>
    </header>
  );
};

export default Header;
