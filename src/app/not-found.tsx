import Header from "@/components/Header";

export default function NotFound() {
    return (
    <>
      <Header />
      <div style={{ textAlign: 'center', marginTop: '50px' }}>
        <h1 className="text-black">404 - Page Not Found</h1>
        <p className="text-black">The page you are looking for doesn&apos;t exist.</p>
      </div>
      </>
    );
  }