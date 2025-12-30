import Link from 'next/link';

export default function HomePage() {
  return (
    <div className="container mx-auto p-8">
      <h1 className="text-3xl font-bold mb-4">Arkiv Next.js Starter</h1>
      <p className="text-gray-600 mb-6">
        A starter template for building Arkiv applications with Next.js.
      </p>
      <Link
        href="/records"
        className="inline-block px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
      >
        View Records
      </Link>
    </div>
  );
}

