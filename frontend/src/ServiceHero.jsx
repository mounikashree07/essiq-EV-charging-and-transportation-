function ServiceHero({ eyebrow, title, description, image, alt }) {
  return (
    <section className="service-hero">
      <div className="service-hero-copy">
        <p className="eyebrow">{eyebrow}</p>
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
      <img className="service-hero-image" src={image} alt={alt} />
    </section>
  );
}

export default ServiceHero;
