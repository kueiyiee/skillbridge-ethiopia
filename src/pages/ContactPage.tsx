import React, { useState } from 'react';
import { Mail, MapPin, Phone, HelpCircle, Send, CheckCircle2, MessageSquare } from 'lucide-react';
import { BackButton } from '@/src/components/navigation/BackButton';

export const ContactPage: React.FC = () => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [subject, setSubject] = useState('General Inquiries');
  const [message, setMessage] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !email.trim() || !message.trim()) return;
    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      setSubmitted(true);
    }, 600);
  };

  const faqs = [
    {
      q: 'How does SKILLBRIDGE verify employer organizations in Ethiopia?',
      a: 'Employers can submit their Tax Identification Number (TIN) and business-registration details for SKILLBRIDGE administrator review. This is an internal document-review workflow; the platform does not connect to a government registry or certify an organization.'
    },
    {
      q: 'How is the Skill Match Score calculated?',
      a: 'The deterministic matcher compares candidate proficiency ranks with weighted job requirements. Mandatory requirements receive 1.5 times their configured weight, and the skill score is combined with an experience score using normalized weights (70% skills and 30% experience by default). The percentage estimates alignment with listed inputs; it is not a hiring probability or guarantee.'
    },
    {
      q: 'Is my personal data shared with unverified recruiters?',
      a: 'Access to candidate information is handled through authenticated, role-authorized application endpoints. Employer approval is an internal SKILLBRIDGE review, not government certification. Share only information needed for your career profile.'
    },
    {
      q: 'How does the Gemini AI Skill Gap Advisor work?',
      a: 'The matcher identifies missing or under-level skills and provides deterministic project and exercise suggestions. A server-side Gemini assistant can provide additional guidance when configured; responses are suggestions, not verified facts, and should be checked against trusted learning resources.'
    }
  ];

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8">
      <BackButton fallbackTo="/" fallbackLabel="Back to Home" />
      
      {/* 1. Header */}
      <div className="space-y-2">
        <div className="text-xs font-bold text-sky-700 uppercase tracking-wider font-heading">
          Help Desk & Academic Inquiries
        </div>
        <h1 className="text-3xl font-extrabold text-slate-950 dark:text-white font-heading">
          Contact & Support Center
        </h1>
        <p className="text-xs text-slate-600 max-w-2xl leading-relaxed">
          Have feedback on the SKILLBRIDGE prototype or need technical assistance with your profile? Send us a message or consult our frequently asked questions.
        </p>
      </div>

      {/* 2. Form + Contact Info Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* Contact Form */}
        <div className="lg:col-span-7 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 transition-colors p-6 sm:p-8 space-y-5">
          <h2 className="text-lg font-bold text-slate-900 font-heading">
            Send an Inquiry or Feedback
          </h2>

          {submitted ? (
            <div className="p-6 bg-emerald-50 border border-emerald-200 rounded-xl text-center space-y-3">
              <CheckCircle2 className="w-10 h-10 text-emerald-600 mx-auto" />
              <h3 className="font-bold text-base text-emerald-950 font-heading">Message Successfully Received</h3>
              <p className="text-xs text-emerald-800">
                Thank you, {name}. Your inquiry has been dispatched to the SKILLBRIDGE academic coordination desk.
              </p>
              <button
                onClick={() => {
                  setSubmitted(false);
                  setName('');
                  setEmail('');
                  setMessage('');
                }}
                className="mt-2 px-4 py-2 bg-emerald-700 text-white text-xs font-semibold rounded-lg hover:bg-emerald-800 transition-colors cursor-pointer"
              >
                Send Another Message
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Your Full Name</label>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. Almaz Tadesse"
                    className="w-full p-2.5 border border-slate-200 rounded-lg focus:outline-none focus:border-sky-500"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Email Address</label>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="name@organization.et"
                    className="w-full p-2.5 border border-slate-200 rounded-lg focus:outline-none focus:border-sky-500"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Inquiry Topic</label>
                <select
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  className="w-full p-2.5 border border-slate-200 rounded-lg focus:outline-none focus:border-sky-500"
                >
                  <option value="General Inquiries">General Platform Inquiries</option>
                  <option value="Employer Verification">Employer TIN / License Verification</option>
                  <option value="Skill Assessment">Skill Taxonomy & Test Feedback</option>
                  <option value="Academic Collaboration">Academic & Research Collaboration</option>
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Detailed Message</label>
                <textarea
                  rows={4}
                  required
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="How can we assist you regarding skills, matching algorithms, or job postings?"
                  className="w-full p-2.5 border border-slate-200 rounded-lg focus:outline-none focus:border-sky-500"
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 bg-sky-600 hover:bg-sky-700 text-white rounded-lg font-semibold flex items-center justify-center gap-2 transition-colors cursor-pointer"
              >
                <Send className="w-4 h-4" />
                <span>{loading ? 'Dispatching Message...' : 'Submit Inquiry'}</span>
              </button>
            </form>
          )}
        </div>

        {/* Office & Academic Details */}
        <div className="lg:col-span-5 space-y-6">
          <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 transition-colors p-6 space-y-4">
            <h3 className="font-bold text-base text-slate-900 font-heading">
              Project Directorate Contact
            </h3>
            <div className="space-y-3 text-xs text-slate-600">
              <div className="flex items-start gap-2.5">
                <MapPin className="w-4 h-4 text-sky-600 mt-0.5 flex-shrink-0" />
                <div>
                  <div className="font-semibold text-slate-900">Dilla University (DU)</div>
                  <div>School of Computing & Informatics</div>
                  <div>Main Campus, Dilla, Ethiopia</div>
                </div>
              </div>

              <div className="flex items-start gap-2.5">
                <Mail className="w-4 h-4 text-sky-600 mt-0.5 flex-shrink-0" />
                <div>
                  <div className="font-semibold text-slate-900">Academic Project Email</div>
                  <a href="mailto:com.scie.du.edu.et" className="text-sky-600 hover:underline">com.scie.du.edu.et</a>
                </div>
              </div>

              <div className="flex items-start gap-2.5">
                <Phone className="w-4 h-4 text-sky-600 mt-0.5 flex-shrink-0" />
                <div>
                  <div className="font-semibold text-slate-900">Coordination Office</div>
                  <a href="tel:+251461310001" className="text-slate-600 hover:text-slate-900">+251461310001</a>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl p-5 text-xs text-slate-600 space-y-2">
            <h4 className="font-bold text-slate-900">Final-Year Research Disclaimer</h4>
            <p className="leading-relaxed">
              SKILLBRIDGE is operated under academic research protocols. All organization profiles and postings rendered in this preview represent verified test environments.
            </p>
          </div>
        </div>

      </div>

      {/* 3. Frequently Asked Questions */}
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 transition-colors p-6 sm:p-8 space-y-6">
        <div className="flex items-center gap-2 border-b border-slate-100 pb-4">
          <HelpCircle className="w-5 h-5 text-sky-600" />
          <h2 className="text-lg font-bold text-slate-900 font-heading">
            Frequently Asked Questions
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-xs">
          {faqs.map((faq, idx) => (
            <div key={idx} className="p-4 rounded-lg bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-2">
              <h3 className="font-bold text-slate-900 text-sm">
                {faq.q}
              </h3>
              <p className="text-slate-600 leading-relaxed">
                {faq.a}
              </p>
            </div>
          ))}
        </div>
      </div>

    </div>
  );
};
