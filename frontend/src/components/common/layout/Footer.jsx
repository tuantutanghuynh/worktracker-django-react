export default function Footer() {
  return (
    <footer className="py-4 px-6 bg-white border-t border-slate-200 text-xs text-slate-500 flex items-center justify-center">
      <p>© {new Date().getFullYear()} WorkTracker Pro. All rights reserved.</p>
    </footer>
  );
}
